"""Trò chuyện với Claude ngay trong app — Claude đọc / ghi VCWIKI thay người dùng.

Mỗi lượt hỏi chạy Claude Code CLI ở chế độ nền (`claude -p`, tài khoản Claude đăng nhập trên máy chủ, không cần
ANTHROPIC_API_KEY):
  - chỉ có công cụ của cổng MCP VCWIKI (`/mcp`) — tắt hết công cụ có sẵn (Bash, sửa file, web…),
    chạy trong thư mục trống, không nạp cấu hình / hook của người dùng máy chủ;
  - xác thực MCP bằng token tạm cấp riêng cho người đang chat (xoá khi lượt xong) → Claude chỉ thấy / sửa
    được những kho người đó có quyền, như khi họ tự thao tác;
  - hội thoại nối tiếp bằng `--resume <session_id>` của CLI; CLI lỗi trước khi gọi công cụ thì
    AI local trả lời chữ / hướng dẫn (SYS-38, SCR-22.1).

Toàn bộ lịch sử nằm trong MongoDB: `chat_threads` (cuộc trò chuyện) và `chat_messages` (từng lượt, gồm văn bản
trả lời, các công cụ Claude đã gọi kèm tham số / kết quả, thời gian, chi phí). FE theo dõi lượt đang chạy qua SSE.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
import traceback
from pathlib import Path

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import auth, db, guide, policy
from .config import AI_FALLBACK, CHAT_ACCESS, CHAT_MODEL, CLAUDE_BIN
from .config import CHAT_MAX_PARALLEL as MAX_PARALLEL
from .config import CHAT_MCP_URL as MCP_URL
from .config import CHAT_SANDBOX as SANDBOX
from .config import CHAT_TIMEOUT as TIMEOUT
from .auth import current_user, users

router = APIRouter(prefix="/api")

threads = db.db["chat_threads"]
messages = db.db["chat_messages"]

# Cấu hình từ biến môi trường: app/config.py (CLAUDE_BIN, CHAT_MODEL, CHAT_ACCESS, CHAT_MAX_PARALLEL, CHAT_TIMEOUT,
# CHAT_SANDBOX — thư mục trống ngoài repo để CLI không nạp CLAUDE.md / .claude của dự án nào, CHAT_MCP_URL)
TOKEN_NAME = "Trò chuyện trong app"
HISTORY_FALLBACK = 12      # phiên CLI mất (máy chủ khác / bị xoá): gửi lại chừng này lượt gần nhất làm bối cảnh
TOOL_PREVIEW = 1500

_slots = threading.Semaphore(MAX_PARALLEL)
_runs: dict[str, "Run"] = {}          # lượt đang chạy, theo id tin nhắn trả lời
_runs_lock = threading.Lock()


def ensure_indexes() -> None:
    threads.create_index([("user_id", 1), ("updated_at", -1)])
    messages.create_index([("thread_id", 1), ("created_at", 1)])
    # lần chạy trước bị ngắt giữa chừng: token tạm còn sót, lượt đang chạy dở
    auth.api_tokens.delete_many({"internal": "chat"})
    messages.update_many({"status": {"$in": ["queued", "running"]}},
                         {"$set": {"status": "error", "error": "Máy chủ khởi động lại khi đang trả lời"}})


# ---------------------------------------------------------------------------
# Chạy Claude CLI
# ---------------------------------------------------------------------------

class Run:
    """Một lượt trả lời: tiến trình CLI + các sự kiện đã phát (SSE đọc lại từ đầu nếu kết nối muộn)."""

    def __init__(self, msg_id: ObjectId):
        self.msg_id = msg_id
        self.events: list[dict] = []
        self.text = ""
        self.tools: list[dict] = []
        self.done = False
        self.proc: subprocess.Popen | None = None
        self.cancelled = False
        self.lock = threading.Lock()

    def emit(self, ev: dict) -> None:
        with self.lock:
            self.events.append(ev)


def system_prompt(user: dict) -> str:
    return (
        "Bạn là trợ lý AI trong VC Content Engine / VCWIKI của VC Phồn Vinh, trò chuyện trực tiếp với "
        f"{user['name']} ({'quản trị viên' if user.get('role') == 'admin' else 'thành viên'}) qua giao diện web. "
        f"Hôm nay là {time.strftime('%d/%m/%Y')}. Trả lời tiếng Việt, rõ ràng, dùng markdown.\n"
        "Bạn thao tác dữ liệu bằng các công cụ VCWIKI (tên bắt đầu mcp__vcwiki__) — với quyền của chính người "
        "đang chat. Khi được yêu cầu, hãy thực thi thật: tìm / đọc thẻ và tài liệu, tạo / sửa thẻ, gắn tag, nạp link, "
        "quét kênh, ghi nhớ. Không bịa dữ liệu: cần số liệu thì gọi công cụ.\n"
        "Trước khi xoá hoặc sửa hàng loạt, nêu rõ sẽ làm gì và hỏi lại. Sau khi ghi dữ liệu, báo ngắn đã làm gì "
        "kèm link. Link trong app (đường dẫn tương đối): thẻ [tiêu đề](/wiki?card=<id>), nguồn "
        "[tên](/kb?source=<id>), lượt tổng hợp [tên](/wiki/synth/<id>).\n"
        "Bạn không có công cụ nào khác ngoài VCWIKI (không chạy lệnh, không đọc file máy chủ).\n"
        "Câu hỏi về cách dùng app (làm thế nào, nút ở đâu, sao không thấy…): đọc Hướng dẫn sử dụng bằng "
        "mcp__vcwiki__read_guide (section=<id>) rồi trả lời đúng tên nút / tab như hướng dẫn, kèm link "
        "[mục](/guide#<id>). Các mục: " + "; ".join(f"{s['id']} — {s['title']}" for s in guide.toc()) + ".\n"
        "Mỗi câu hỏi có thể kèm dòng [Người dùng đang mở trang: …] — đó là bối cảnh: khi câu hỏi nói 'trang này', "
        "'thẻ này', 'video này'… thì đọc đúng đối tượng trên trang đó: /wiki?card=<id> → get_card; /kb?source=<id> → "
        "get_source; /kb/videos?video=<id> → get_video; /wiki/synth/<id> → get_synth; /studio/<id> → get_campaign; "
        "/studio/projects/<id> → dự án marketing; /learn/lessons/<id> → bài học; /wiki?category=<slug> → thẻ trong "
        "nhánh đó (search_cards). Không có dòng đó nghĩa là vẫn ở trang lần trước."
    )


def build_cmd(mcp_file: str, user: dict, session_id: str | None) -> list[str]:
    cmd = [CLAUDE_BIN, "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
           "--mcp-config", mcp_file, "--strict-mcp-config",
           "--tools", "",                          # tắt mọi công cụ có sẵn của Claude Code
           "--allowedTools", "mcp__vcwiki",        # chỉ công cụ VCWIKI, không hỏi quyền
           "--permission-mode", "dontAsk",         # công cụ ngoài danh sách: từ chối
           "--setting-sources", "project",         # thư mục trống → không nạp hook / plugin của máy chủ
           "--append-system-prompt", system_prompt(user)]
    if CHAT_MODEL:
        cmd += ["--model", CHAT_MODEL]
    if session_id:
        cmd += ["--resume", session_id]
    return cmd


def _preview(v) -> str:
    if isinstance(v, list):
        v = "\n".join(x.get("text", "") if isinstance(x, dict) else str(x) for x in v)
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    try:   # công cụ MCP trả {"result": "<json>"} — bóc ra cho dễ đọc
        inner = json.loads(s)
        if isinstance(inner, dict) and set(inner) == {"result"}:
            s = inner["result"]
    except (ValueError, TypeError):
        pass
    return s[:TOOL_PREVIEW] + ("…" if len(s) > TOOL_PREVIEW else "")


def _cli_ready() -> bool:
    """Có lệnh thực thi, kể cả CLAUDE_BIN là tên trên PATH."""
    return bool(shutil.which(CLAUDE_BIN))


def _local_status(fresh: bool = False) -> dict:
    from .kb import local_ai
    if AI_FALLBACK != "local":
        return {"ready": False, "model": local_ai.LOCAL_LLM_MODEL, "error": "Đã tắt AI local dự phòng"}
    info = local_ai.status(fresh=fresh)
    return {k: info[k] for k in ("ready", "model", "error")}


def _history_text(rows: list[dict]) -> str:
    if not rows:
        return ""
    lines = [f"{'Người dùng' if r['role'] == 'user' else 'Bạn'}: "
             f"{context_line(r.get('context'))}{r.get('content', '')[:3000]}" for r in rows]
    return "Bối cảnh — các lượt trước trong cuộc trò chuyện này:\n\n" + "\n\n".join(lines) + "\n\n---\n\n"


def fallback_history(thread_id: ObjectId, before) -> str:
    rows = list(messages.find({"thread_id": thread_id, "created_at": {"$lt": before}, "status": "done"},
                              {"role": 1, "content": 1, "context": 1}).sort([("created_at", -1), ("_id", -1)])
                .limit(HISTORY_FALLBACK))
    return _history_text(list(reversed(rows)))


def _prior_turns(thread: dict, mid: ObjectId) -> tuple[list[dict], str | None]:
    """Lịch sử trước câu đang trả lời; ObjectId phân xử cả các tin cùng mili giây."""
    current = messages.find_one({"thread_id": thread["_id"], "role": "user", "_id": {"$lt": mid}},
                                sort=[("_id", -1)])
    before = current["_id"] if current else mid
    rows = list(messages.find({"thread_id": thread["_id"], "_id": {"$lt": before}, "status": "done"},
                              {"role": 1, "content": 1, "context": 1}).sort("_id", -1).limit(HISTORY_FALLBACK))
    context = messages.find_one({"thread_id": thread["_id"], "role": "user", "_id": {"$lt": mid},
                                 "context": {"$type": "string", "$ne": ""}}, sort=[("_id", -1)])
    return list(reversed(rows)), (context or {}).get("context")


def execute(run: Run, thread: dict, user: dict, prompt: str, mcp_url: str) -> None:
    """Xếp hàng → Claude CLI → Ollama nếu CLI không hoạt động → lưu cùng một lượt."""
    mid = run.msg_id
    token = mcp_file = None
    started = time.time()
    result: dict = {}
    error = None
    local_started = False
    try:
        run.emit({"t": "status", "status": "queued"})
        with _slots:
            if run.cancelled:
                raise RuntimeError("Đã dừng")
            messages.update_one({"_id": mid}, {"$set": {"status": "running", "started_at": db.now()}})
            run.emit({"t": "status", "status": "running"})
            history, context = _prior_turns(thread, mid)
            if _cli_ready():
                token, tdoc = auth.issue_api_token(user, TOKEN_NAME)
                auth.api_tokens.update_one({"_id": tdoc["_id"]}, {"$set": {"internal": "chat"}})
                SANDBOX.mkdir(parents=True, exist_ok=True)
                fd, mcp_file = tempfile.mkstemp(prefix="mcp-", suffix=".json", dir=SANDBOX)
                with os.fdopen(fd, "w") as f:
                    json.dump({"mcpServers": {"vcwiki": {"type": "http", "url": mcp_url,
                                                         "headers": {"Authorization": f"Bearer {token}"}}}}, f)
                os.chmod(mcp_file, 0o600)
                session = thread.get("claude_session_id")
                try:
                    result = _run_cli(run, build_cmd(mcp_file, user, session),
                                      ("" if session else _history_text(history)) + prompt)
                    if result.get("resume_failed") and not run.cancelled and not run.text and not run.tools:
                        run.emit({"t": "status", "status": "running", "note": "Mở phiên mới kèm lịch sử"})
                        result = _run_cli(run, build_cmd(mcp_file, user, None), _history_text(history) + prompt)
                except (OSError, ValueError, subprocess.TimeoutExpired) as e:
                    result = {"is_error": True, "error": f"Claude CLI lỗi: {str(e)[:300]}"}
            else:
                result = {"is_error": True, "error": "Máy chủ chưa cài Claude Code CLI hoặc lệnh không chạy được"}

            if run.cancelled:
                error = "Đã dừng"
            elif result.get("is_error") or result.get("resume_failed"):
                error = result.get("error") or "Không mở được phiên Claude"
                if AI_FALLBACK == "local" and not run.tools:
                    from . import chat_local
                    from .kb import ai_slot
                    cli_error = error
                    local = _local_status(fresh=True)
                    if not local["ready"]:
                        error = f"{cli_error} — AI local chưa sẵn sàng: {local['error']}"
                    elif not run.cancelled:
                        # Phiên CLI không biết các lượt local; lần CLI kế phải nhận lịch sử DB.
                        local_started = True
                        threads.update_one({"_id": thread["_id"]}, {"$set": {"claude_session_id": None}})
                        result = {"model": f"local:{local['model']}", "cost_usd": result.get("cost_usd") or 0}
                        run.text = ""
                        run.emit({"t": "reset"})
                        note = "Claude CLI không hoạt động; chuyển sang AI local."
                        run.emit({"t": "status", "status": "running", "model": result["model"], "note": note})
                        messages.update_one({"_id": mid}, {"$set": {"content": "", "model": result["model"]}})
                        try:
                            with ai_slot.hold("tinh_che", "Trò chuyện bằng AI local", cancelled=lambda: run.cancelled):
                                if run.cancelled:
                                    raise RuntimeError("Đã dừng")
                                local_result = chat_local.answer(run, user, prompt, history, context)
                            result.update(local_result, cost_usd=result["cost_usd"])
                            error = "Đã dừng" if run.cancelled else None
                        except Exception as e:  # noqa: BLE001 — một lượt local lỗi không gọi vòng lại CLI
                            error = "Đã dừng" if run.cancelled else f"{cli_error} — AI local lỗi: {str(e)[:300]}"
            if run.cancelled:
                error = "Đã dừng"
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        error = "Đã dừng" if run.cancelled else str(e)[:500]
    finally:
        if token:
            auth.api_tokens.delete_one({"_id": auth._token_hash(token)})
        if mcp_file:
            Path(mcp_file).unlink(missing_ok=True)

    if error:
        for tool in run.tools:
            if tool.get("status") == "running":
                tool.update(status="error", result="Lượt đã dừng; chưa xác nhận kết quả thao tác.")
    text = run.text.strip() or (result.get("text") or "").strip()
    upd = {"status": "error" if error and not (run.cancelled and text) else "done",
           "content": text, "tools": run.tools, "error": error, "finished_at": db.now(),
           "duration_ms": round((time.time() - started) * 1000),
           "cost_usd": result.get("cost_usd"), "usage": result.get("usage"), "model": result.get("model")}
    messages.update_one({"_id": mid}, {"$set": upd})
    tset = {"updated_at": db.now()}
    if result.get("session_id") and not result.get("is_error") and not error and not local_started:
        tset["claude_session_id"] = result["session_id"]
    threads.update_one({"_id": thread["_id"]}, {"$set": tset, "$inc": {"cost_usd": result.get("cost_usd") or 0}})
    run.emit({"t": "done", "message": message_out(messages.find_one({"_id": mid}))})
    run.done = True
    threading.Timer(60, lambda: _runs.pop(str(mid), None)).start()


def _run_cli(run: Run, cmd: list[str], prompt: str) -> dict:
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDECODE", "CLAUDE_CODE_"))}
    proc = subprocess.Popen(cmd, cwd=SANDBOX, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, bufsize=1)
    run.proc = proc
    killer = threading.Timer(TIMEOUT, proc.kill)
    killer.start()
    stderr_buf: list[str] = []
    stderr_reader = threading.Thread(target=lambda: stderr_buf.extend(proc.stderr), daemon=True)
    stderr_reader.start()

    out: dict = {}
    tool_index: dict[str, dict] = {}
    last_flush = time.time()
    new_block = False
    completed = False
    try:
        proc.stdin.write(prompt)
        proc.stdin.close()
        for line in proc.stdout:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if not isinstance(e, dict):
                raise ValueError("Claude CLI trả dữ liệu không hợp lệ")
            t = e.get("type")
            if t == "system" and e.get("subtype") == "init":
                out["session_id"] = e.get("session_id")
                out["model"] = e.get("model")
            elif t == "stream_event":
                ev = e.get("event") or {}
                if ev.get("type") == "content_block_start" and (ev.get("content_block") or {}).get("type") == "text":
                    new_block = bool(run.text)
                elif ev.get("type") == "content_block_delta" and (ev.get("delta") or {}).get("type") == "text_delta":
                    d = ev["delta"]["text"]
                    if new_block:
                        d, new_block = "\n\n" + d, False
                    run.text += d
                    run.emit({"t": "text", "d": d})
            elif t == "assistant":
                for c in (e.get("message") or {}).get("content") or []:
                    if c.get("type") == "tool_use":
                        tool = {"id": c["id"], "name": c["name"].removeprefix("mcp__vcwiki__"),
                                "input": c.get("input") or {}, "status": "running"}
                        tool_index[c["id"]] = tool
                        run.tools.append(tool)
                        run.emit({"t": "tool", "tool": tool})
            elif t == "user":
                for c in (e.get("message") or {}).get("content") or []:
                    if isinstance(c, dict) and c.get("type") == "tool_result" and c.get("tool_use_id") in tool_index:
                        tool = tool_index[c["tool_use_id"]]
                        tool["status"] = "error" if c.get("is_error") else "done"
                        tool["result"] = _preview(c.get("content"))
                        run.emit({"t": "tool_result", "tool": tool})
            elif t == "result":
                completed = True
                out.update(is_error=bool(e.get("is_error")), cost_usd=e.get("total_cost_usd"), usage=e.get("usage"),
                           text=e.get("result"), session_id=e.get("session_id") or out.get("session_id"))
                if e.get("is_error"):
                    out["error"] = (e.get("result") or e.get("subtype") or "")[:500]
            if time.time() - last_flush > 1.5:   # tải lại trang giữa chừng vẫn thấy phần đã trả lời
                messages.update_one({"_id": run.msg_id}, {"$set": {"content": run.text, "tools": run.tools}})
                last_flush = time.time()
        proc.wait()
    except (AttributeError, KeyError, TypeError) as exc:
        raise ValueError("Claude CLI trả dữ liệu không hợp lệ") from exc
    finally:
        killer.cancel()
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        stderr_reader.join(timeout=1)
        for pipe in (proc.stdin, proc.stdout, proc.stderr):
            pipe.close()
        run.proc = None
    err = "".join(stderr_buf)
    if "No conversation found" in err or "No conversation found" in (out.get("error") or ""):
        return out | {"resume_failed": True, "is_error": True, "error": "Không tìm thấy phiên Claude"}
    if proc.returncode and not out.get("is_error") and not run.cancelled:
        out.update(is_error=True, error=(err.strip() or f"Claude CLI thoát với mã {proc.returncode}")[-500:])
        if proc.returncode == -9:
            out["error"] = f"Quá {TIMEOUT // 60} phút — đã dừng"
    if not out.get("is_error") and not run.cancelled and (not completed or not (run.text.strip() or (out.get("text") or "").strip())):
        out.update(is_error=True, error="Claude CLI không trả kết quả hoàn chỉnh")
    return out


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Không tìm thấy") from None


def chat_user(user: dict = Depends(current_user)) -> dict:
    if CHAT_ACCESS == "admin" and user.get("role") != "admin":
        raise HTTPException(403, "Trò chuyện với Claude hiện chỉ mở cho quản trị viên")
    return user


def load_thread(tid: str, user: dict) -> dict:
    t = threads.find_one({"_id": _oid(tid)})
    # chỉ người tạo xem được: câu trả lời chứa nội dung kho riêng của họ — quản trị viên cũng không (ORG-13)
    if not t:
        raise HTTPException(404, "Không tìm thấy cuộc trò chuyện")
    policy.require(user, "chat.read", t, "cuộc trò chuyện")
    return t


def mine(t: dict, user: dict) -> dict:
    if t["user_id"] != user["_id"]:
        raise HTTPException(403, "Chỉ người tạo cuộc trò chuyện được thao tác")
    return t


def thread_out(t: dict, names: dict | None = None) -> dict:
    return {"id": str(t["_id"]), "title": t.get("title") or "Cuộc trò chuyện mới", "user_id": str(t["user_id"]),
            "user_name": (names or {}).get(t["user_id"]), "message_count": t.get("message_count", 0),
            "cost_usd": round(t.get("cost_usd") or 0, 4), "created_at": t["created_at"], "updated_at": t["updated_at"]}


def message_out(m: dict) -> dict:
    return {"id": str(m["_id"]), "role": m["role"], "content": m.get("content", ""), "status": m.get("status"),
            "tools": m.get("tools") or [], "error": m.get("error"), "context": m.get("context"),
            "created_at": m["created_at"], "finished_at": m.get("finished_at"), "duration_ms": m.get("duration_ms"),
            "cost_usd": m.get("cost_usd"), "model": m.get("model")}


@router.get("/chat/status")
def chat_status(user: dict = Depends(current_user)):
    ok = _cli_ready()
    local = _local_status()
    allowed = CHAT_ACCESS != "admin" or user.get("role") == "admin"
    return {"available": (ok or local["ready"]) and allowed, "cli": ok, "allowed": allowed, "access": CHAT_ACCESS,
            "local": local, "fallback": AI_FALLBACK == "local",
            "running": sum(1 for r in _runs.values() if not r.done), "max_parallel": MAX_PARALLEL}


@router.get("/chat/threads")
def list_threads(all: bool = False, q: str = "", page: int = Query(1, ge=1), page_size: int = Query(50, le=200),
                 user: dict = Depends(chat_user)):
    # `all` giữ cho tương thích giao diện cũ; từ ORG-13 không còn xem cuộc trò chuyện của người khác
    f: dict = {"user_id": user["_id"]}
    if q.strip():
        f["search_text"] = db.search_regex(q)
    rows = list(threads.find(f).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size))
    names = {u["_id"]: u["name"] for u in users.find({"_id": {"$in": list({r["user_id"] for r in rows})}}, {"name": 1})}
    return {"total": threads.count_documents(f), "items": [thread_out(r, names) for r in rows]}


class ThreadIn(BaseModel):
    title: str = Field("", max_length=120)


@router.post("/chat/threads", status_code=201)
def create_thread(body: ThreadIn, user: dict = Depends(chat_user)):
    now = db.now()
    t = {"user_id": user["_id"], "title": body.title.strip(), "message_count": 0, "cost_usd": 0,
         "claude_session_id": None, "search_text": db.unaccent(body.title), "created_at": now, "updated_at": now}
    t["_id"] = threads.insert_one(t).inserted_id
    return thread_out(t)


@router.get("/chat/threads/{tid}")
def get_thread(tid: str, user: dict = Depends(chat_user)):
    t = load_thread(tid, user)
    names = {user["_id"]: user["name"]} if t["user_id"] == user["_id"] else \
        {u["_id"]: u["name"] for u in users.find({"_id": t["user_id"]}, {"name": 1})}
    rows = messages.find({"thread_id": t["_id"]}).sort("created_at", 1)
    return thread_out(t, names) | {"messages": [message_out(m) for m in rows], "can_write": t["user_id"] == user["_id"]}


@router.patch("/chat/threads/{tid}")
def rename_thread(tid: str, body: ThreadIn, user: dict = Depends(chat_user)):
    t = mine(load_thread(tid, user), user)
    threads.update_one({"_id": t["_id"]}, {"$set": {"title": body.title.strip()}})
    return thread_out(threads.find_one({"_id": t["_id"]}))


@router.delete("/chat/threads/{tid}", status_code=204)
def delete_thread(tid: str, user: dict = Depends(chat_user)):
    t = mine(load_thread(tid, user), user)
    if messages.count_documents({"thread_id": t["_id"], "status": {"$in": ["queued", "running"]}}):
        raise HTTPException(409, "Claude đang trả lời — dừng lượt đó trước")
    messages.delete_many({"thread_id": t["_id"]})
    threads.delete_one({"_id": t["_id"]})
    return Response(status_code=204)


def context_line(context: str | None) -> str:
    """Dòng bối cảnh đặt trước câu hỏi: trang đang mở (đường dẫn + tiêu đề tab nếu FE gửi) và mục hướng dẫn
    liên quan để Claude biết đọc gì. Trống -> không thêm gì (Claude giữ bối cảnh lần trước)."""
    if not context:
        return ""
    related = guide.for_path(context.split(" (", 1)[0])
    hint = (" — mục hướng dẫn liên quan: " + ", ".join(f"{r['id']} ({r['title']})" for r in related)) if related else ""
    return f"[Người dùng đang mở trang: {context}{hint}]\n\n"


class MessageIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)
    context: str | None = Field(None, max_length=500)   # trang người dùng đang xem, vd /kb?source=…


@router.post("/chat/threads/{tid}/messages", status_code=201)
def send_message(tid: str, body: MessageIn, request: Request, user: dict = Depends(chat_user)):
    t = mine(load_thread(tid, user), user)
    if not _cli_ready():
        local = _local_status(fresh=True)
        if not local["ready"]:
            raise HTTPException(503, f"Claude CLI không sẵn sàng — {local['error']}")
    if messages.find_one({"thread_id": t["_id"], "status": {"$in": ["queued", "running"]}}, {"_id": 1}):
        raise HTTPException(409, "Claude đang trả lời câu trước")
    now = db.now()
    text = body.text.strip()
    um = {"thread_id": t["_id"], "user_id": user["_id"], "role": "user", "content": text, "status": "done",
          "context": body.context, "created_at": now}
    um["_id"] = messages.insert_one(um).inserted_id
    am = {"thread_id": t["_id"], "user_id": user["_id"], "role": "assistant", "content": "", "status": "queued",
          "tools": [], "created_at": db.now()}
    am["_id"] = messages.insert_one(am).inserted_id
    upd = {"updated_at": now}
    if not t.get("title"):
        upd["title"] = text.splitlines()[0][:80]
    threads.update_one({"_id": t["_id"]}, {"$set": upd | {"search_text": db.unaccent(upd.get("title") or t["title"])},
                                           "$inc": {"message_count": 2}})

    prompt = context_line(body.context) + text
    mcp_url = MCP_URL or f"http://127.0.0.1:{request.url.port or 8000}/mcp"
    run = Run(am["_id"])
    with _runs_lock:
        _runs[str(am["_id"])] = run
    threading.Thread(target=execute, args=(run, t, user, prompt, mcp_url), daemon=True).start()
    return {"user_message": message_out(um), "assistant_message": message_out(am)}


@router.post("/chat/messages/{mid}/cancel")
def cancel_message(mid: str, user: dict = Depends(chat_user)):
    m = messages.find_one({"_id": _oid(mid), "user_id": user["_id"]})
    if not m:
        raise HTTPException(404, "Không tìm thấy")
    run = _runs.get(mid)
    if run and not run.done:
        run.cancelled = True
        if run.proc and run.proc.poll() is None:
            run.proc.terminate()
    return {"ok": True}


@router.get("/chat/messages/{mid}/stream")
async def stream_message(mid: str, request: Request, user: dict = Depends(chat_user)):
    """SSE của một lượt trả lời: phát lại sự kiện từ đầu rồi theo dõi tiếp tới khi xong."""
    m = messages.find_one({"_id": _oid(mid)})
    if not m:
        raise HTTPException(404, "Không tìm thấy")
    load_thread(str(m["thread_id"]), user)

    async def events():
        run = _runs.get(mid)
        if not run:   # đã xong từ trước (hoặc máy chủ khởi động lại)
            yield f"data: {json.dumps({'t': 'done', 'message': message_out(messages.find_one({'_id': m['_id']}))}, default=str, ensure_ascii=False)}\n\n"
            return
        sent, idle = 0, 0
        while not await request.is_disconnected():
            with run.lock:
                batch = run.events[sent:]
            for ev in batch:
                yield f"data: {json.dumps(ev, default=str, ensure_ascii=False)}\n\n"
            sent += len(batch)
            if batch and batch[-1].get("t") == "done":
                return
            idle = 0 if batch else idle + 1
            if idle and idle % 75 == 0:
                yield ": ping\n\n"
            await asyncio.sleep(0.2)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
