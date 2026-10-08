"""Loop test of the worker against a fake API (no model): python3 -m unittest workers/asr/test_worker.py"""
import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

os.environ["ASR_BACKEND"] = "stub"
import worker  # noqa: E402

AUDIO = b"fake-audio"


class Fake(BaseHTTPRequestHandler):
    state = {"queue": [{"jobId": "a1", "attachmentId": "a1", "audioPath": "/api/asr/jobs/a1/audio"}], "results": {}, "fails": {}}

    def log_message(self, *a):
        pass

    def _json(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        assert self.headers["Authorization"] == "Bearer tok"
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        if self.path.endswith("/claim"):
            q = self.state["queue"]
            return self._json(q.pop(0) if q else {"jobId": None})
        jid = self.path.split("/")[-2]
        (self.state["results"] if self.path.endswith("/result") else self.state["fails"])[jid] = body
        self._json({"ok": True})

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Length", str(len(AUDIO)))
        self.end_headers()
        self.wfile.write(AUDIO)


class WorkerTest(unittest.TestCase):
    def test_claims_downloads_and_posts_result(self):
        srv = HTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        os.environ.update(ASR_API_URL=f"http://127.0.0.1:{srv.server_port}", ASR_API_TOKEN="tok")
        self.assertEqual(worker.run(once=True), 0)
        srv.shutdown()
        res = Fake.state["results"]["a1"]
        self.assertEqual((res["model"], res["lang"]), ("stub", "vi"))
        self.assertTrue(res["text"])
        self.assertEqual(Fake.state["fails"], {})


if __name__ == "__main__":
    unittest.main()
