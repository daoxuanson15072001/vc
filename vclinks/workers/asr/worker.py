"""VClinks ASR worker (M1c-04): voice notes -> Vietnamese text with faster-whisper.

Polls the VClinks API (token scope `ingest`):
  POST /api/asr/jobs/claim            -> {jobId, attachmentId, mime, size, audioPath} or {jobId: null}
  GET  <audioPath>                    -> audio bytes
  POST /api/asr/jobs/<id>/result      -> {text, lang, model, durationSec}
  POST /api/asr/jobs/<id>/fail        -> {error}

Settings (environment):
  ASR_API_URL      API origin, default http://localhost:3000
  ASR_API_TOKEN    ingest-scope token (required)
  ASR_MODEL        faster-whisper model: tiny | base | small (default) | medium | large-v3 ...
                   `small` runs on a CPU; use large-v3 when the ASR machine (E8) exists.
  ASR_DEVICE       cpu (default) | cuda | auto
  ASR_COMPUTE      int8 (default on cpu) | float16 (gpu) ...
  ASR_LANG         vi (default)
  ASR_POLL_SEC     idle poll period, default 3
  ASR_BACKEND      whisper (default) | stub (fixed text, for tests of the loop only)

Privacy (CLAUDE.md section 12): audio and text are customer data. Nothing but ids, sizes and timings is
logged; audio is kept in a temp file only while it is transcribed.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request

log = logging.getLogger("asr")


class Api:
    def __init__(self, base: str, token: str):
        self.base = base.rstrip("/")
        self.token = token

    def _req(self, method: str, path: str, body: dict | None = None, timeout: int = 120):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        return urllib.request.urlopen(req, timeout=timeout)

    def claim(self) -> dict | None:
        with self._req("POST", "/api/asr/jobs/claim", {}) as r:
            job = json.loads(r.read())
        return job if job.get("jobId") else None

    def download(self, path: str, dest: str) -> None:
        with self._req("GET", path, timeout=300) as r, open(dest, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)

    def result(self, job_id: str, text: str, model: str, lang: str, duration: float | None) -> None:
        body = {"text": text, "lang": lang, "model": model}
        if duration is not None:
            body["durationSec"] = round(duration, 2)
        with self._req("POST", f"/api/asr/jobs/{job_id}/result", body):
            pass

    def fail(self, job_id: str, error: str) -> None:
        with self._req("POST", f"/api/asr/jobs/{job_id}/fail", {"error": error[:120]}):
            pass


class WhisperTranscriber:
    def __init__(self, model: str, device: str, compute: str, lang: str):
        from faster_whisper import WhisperModel  # heavy import: only when really transcribing

        self.name = f"faster-whisper-{model}"
        self.lang = lang
        t0 = time.time()
        self.model = WhisperModel(model, device=device, compute_type=compute)
        log.info("model %s loaded in %.1fs (device=%s, compute=%s)", model, time.time() - t0, device, compute)

    def transcribe(self, path: str) -> tuple[str, float | None]:
        segments, info = self.model.transcribe(path, language=self.lang, vad_filter=True, beam_size=5)
        text = " ".join(s.text.strip() for s in segments).strip()
        return text, getattr(info, "duration", None)


class StubTranscriber:
    name = "stub"
    lang = "vi"

    def transcribe(self, path: str) -> tuple[str, float | None]:
        return "bản chữ thử của worker (stub)", None


def make_transcriber():
    if os.environ.get("ASR_BACKEND", "whisper") == "stub":
        return StubTranscriber()
    model = os.environ.get("ASR_MODEL", "small")
    device = os.environ.get("ASR_DEVICE", "cpu")
    compute = os.environ.get("ASR_COMPUTE", "int8" if device == "cpu" else "float16")
    return WhisperTranscriber(model, device, compute, os.environ.get("ASR_LANG", "vi"))


def process(api: Api, tr, job: dict) -> None:
    jid = job["jobId"]
    fd, path = tempfile.mkstemp(prefix="asr-", suffix=".audio")
    os.close(fd)
    t0 = time.time()
    try:
        api.download(job["audioPath"], path)
        text, duration = tr.transcribe(path)
        api.result(jid, text, tr.name, getattr(tr, "lang", "vi"), duration)
        # Ids and numbers only: the text is customer data.
        log.info("job %s done: %d chars, audio %.1fs, took %.1fs", jid, len(text), duration or 0, time.time() - t0)
    except Exception as e:  # report and carry on with the next job
        log.warning("job %s failed: %s", jid, type(e).__name__)
        if os.environ.get("ASR_DEBUG") == "1":  # traceback may hold paths, never text; off by default
            log.exception("job %s traceback", jid)
        try:
            api.fail(jid, type(e).__name__)
        except Exception:
            log.warning("job %s: could not report failure", jid)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def run(once: bool = False) -> int:
    token = os.environ.get("ASR_API_TOKEN")
    if not token:
        print("ASR_API_TOKEN is required (an ingest-scope VClinks token)", file=sys.stderr)
        return 2
    api = Api(os.environ.get("ASR_API_URL", "http://localhost:3000"), token)
    poll = float(os.environ.get("ASR_POLL_SEC", "3"))
    tr = make_transcriber()
    while True:
        try:
            job = api.claim()
        except (urllib.error.URLError, OSError) as e:
            log.warning("API not reachable: %s", type(e).__name__)
            job = None
        if job:
            process(api, tr, job)
            continue
        if once:
            return 0
        time.sleep(poll)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(run(once="--once" in sys.argv))
