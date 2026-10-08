"""SYS-39 SCR-22.2: công cụ đọc nghiệp vụ cho AI local, dùng lại MCP và quyền người chat."""

from __future__ import annotations

import asyncio
import json
import re
from types import SimpleNamespace

from . import auth, db, guide, mcp_server

ALLOWED = frozenset({
    "whoami", "get_system_spec", "read_ba", "read_guide", "list_spaces", "list_categories",
    "search_cards", "get_card", "recall_memory", "list_sources", "get_source", "get_document",
    "list_documents", "search_documents", "list_tags", "search_videos", "get_video", "list_channels",
    "stats", "get_scan", "list_review_queue", "my_assignments", "list_courses", "get_course",
})
MAX_CALLS = 5
PLAN_SCHEMA = {"type": "object", "properties": {
    "tool": {"type": "string", "enum": ["", *sorted(ALLOWED)]},
    "arguments": {"type": "object"}}, "required": ["tool", "arguments"], "additionalProperties": False}


def registry() -> dict:
    return {t.name: t for t in mcp_server.mcp._tool_manager.list_tools()
            if t.name in ALLOWED and t.annotations and t.annotations.read_only_hint}


def catalog() -> str:
    return "\n".join(f"{name}({', '.join(tool.parameters.get('properties', {}))}): "
                     f"{tool.description.splitlines()[0][:130]}" for name, tool in registry().items())


def terms(prompt: str) -> set[str]:
    text = db.unaccent(prompt).replace("vi deo", "video")
    stop = {"toi", "tao", "cho", "cac", "cua", "nhu", "nao", "the", "vao", "de", "la", "co",
            "khong", "duoc", "gi", "va", "mot", "nay", "ban", "anh", "nguoi", "dung", "lam"}
    return {w for w in re.findall(r"[a-z0-9_-]+", text) if len(w) > 2 and w not in stop}


def guide_seed(prompt: str, context: str | None) -> str | None:
    keys = terms(prompt)
    if "get_document" in prompt or (keys & {"tong", "tom"} and keys & {"nguon", "tai", "5w2h"}):
        return None
    if keys & {"video", "tiktok", "youtube", "upload", "file"}:
        return "nap-tu-lieu"
    scored = []
    for section in guide.sections():
        title = terms(section["title"])
        body = terms(section["body"])
        score = len(keys & title) * 5 + len(keys & body)
        if score:
            scored.append((score, section["id"]))
    if scored:
        return max(scored)[1]
    hints = guide.for_path(context) if context else []
    return hints[0]["id"] if hints else None


def compact(text: str, prompt: str, limit: int = 6000) -> str:
    """Giữ metadata JSON; trích chữ dài theo đoạn liên quan câu hỏi, có nhãn lược bớt."""
    if len(text) <= limit:
        return text
    try:
        obj = json.loads(text)
    except (ValueError, TypeError):
        obj = None
    if isinstance(obj, dict):
        content_field = next((k for k in ("text", "body") if isinstance(obj.get(k), str)), None)
        if content_field:
            # Metadata dài không được đẩy phần nghiệp vụ ra khỏi ngữ cảnh.
            keep = {k: obj[k] for k in ("id", "source_id", "title", "url", "offset", "next_offset", "total_chars", "anchor") if k in obj}
            content = obj[content_field]
            if "## Lời nói" in content:
                content = content[content.index("## Lời nói"):]
            overhead = len(json.dumps(keep, ensure_ascii=False)) + 50
            keep[content_field] = compact(content, prompt, max(150, limit - overhead))
            reduced = json.dumps(keep, ensure_ascii=False)
            if len(reduced) <= limit:
                return reduced
    paragraphs = text.split("\n")
    keys = terms(prompt)
    ranked = sorted(range(len(paragraphs)), key=lambda i: len(keys & terms(paragraphs[i])), reverse=True)
    selected = {0}
    used = len(paragraphs[0]) if paragraphs else 0
    for i in ranked:
        if used + len(paragraphs[i]) + 1 <= limit - 100:
            selected.add(i)
            used += len(paragraphs[i]) + 1
    part = "\n".join(paragraphs[i] for i in sorted(selected))[:limit - 100]
    return part + "\n[Trích đoạn; kết quả dài đã lược bớt. Có thể gọi công cụ đọc tiếp.]"


async def call(run, name: str, arguments: dict, token: str, prompt: str) -> str:
    if run.cancelled:
        raise RuntimeError("Đã dừng")
    tools = registry()
    tool = tools.get(name)
    if tool is None:
        raise ValueError("Công cụ không được phép cho AI local")
    if not isinstance(arguments, dict) or set(arguments) - set(tool.parameters.get("properties", {})):
        raise ValueError("Tham số công cụ không hợp lệ")
    # Schema Pydantic của MCP kiểm kiểu, tham số bắt buộc và Literal, không nhận ctx / token từ model.
    entry = {"id": f"local-{len(run.tools) + 1}", "name": name, "input": arguments, "status": "running"}
    run.tools.append(entry)
    run.emit({"t": "tool", "tool": dict(entry)})
    ctx = SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "vc-local-ai"})
    try:
        result = await asyncio.to_thread(lambda: asyncio.run(tool.run(arguments, ctx)))
        if run.cancelled:
            raise RuntimeError("Đã dừng")
        text = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False, default=str)
        text = compact(text, prompt)
        entry.update(status="done", result=text)
        return text
    except asyncio.CancelledError:
        entry.update(status="error", result="Đã dừng lượt tra cứu")
        raise
    except Exception as exc:
        entry.update(status="error", result=str(exc)[:500])
        return json.dumps({"error": entry["result"]}, ensure_ascii=False)
    finally:
        run.emit({"t": "tool_result", "tool": dict(entry)})


async def ground(run, user: dict, prompt: str, context: str | None, plan) -> list[dict]:
    """Token chỉ sống trong vòng đọc; model chỉ chọn tên công cụ và tham số, không thấy token."""
    token, document = auth.issue_api_token(user, "Tra cứu AI local")
    results = []
    try:
        auth.api_tokens.update_one({"_id": document["_id"]}, {"$set": {"internal": "chat"}})
        seed = guide_seed(prompt, context)
        if seed:
            data = await call(run, "read_guide", {"section": seed}, token, prompt)
            results.append({"tool": "read_guide", "result": data})
        seen = set()
        for _ in range(MAX_CALLS):
            if run.cancelled:
                raise RuntimeError("Đã dừng")
            choice = await plan(results)
            name, arguments = choice.get("tool"), choice.get("arguments")
            if name == "":
                break
            key = json.dumps([name, arguments], sort_keys=True, ensure_ascii=False)
            if key in seen:
                results.append({"error": "Công cụ lặp lại; hãy trả lời theo dữ liệu đã đọc."})
                break
            seen.add(key)
            try:
                data = await call(run, name, arguments, token, prompt)
                results.append({"tool": name, "result": data})
            except ValueError as exc:
                results.append({"error": str(exc)})
        return results
    finally:
        auth.api_tokens.delete_one({"_id": document["_id"]})
