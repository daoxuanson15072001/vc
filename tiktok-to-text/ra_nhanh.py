#!/usr/bin/env python3
"""Bảng theo dõi worktree / nhánh / phiên Claude (DESIGN Phần 0 mục 0.8.4) — trang HTML chỉ đọc, chạy trên máy.

Ghép bốn nguồn: git (nhánh, commit chưa vào develop, file đang sửa), tiến trình đang đứng trong worktree (lsof),
log phiên Claude Code ở ~/.claude/projects (tên phiên, yêu cầu đầu, agent nền + việc được giao), merge gần đây.

  python3 ra_nhanh.py              ghi output/ra_nhanh.html
  python3 ra_nhanh.py --mo         ghi rồi mở trình duyệt
  python3 ra_nhanh.py --mo --lap 30   dựng lại mỗi 30 giây, trang tự tải lại (Ctrl+C để dừng)
  python3 ra_nhanh.py --cong 8900 --lap 30   phục vụ trang ở http://127.0.0.1:8900 — mở trong VS Code:
                                   Cmd+Shift+P → "Simple Browser: Show" (file:// .html thì VS Code mở ra mã nguồn)
                                   /tro-chuyen: lưới nội dung các phiên Claude gần đây, tự cập nhật mỗi 5 giây
Không ghi gì vào git. RA_NHANH_BASE (mặc định develop), RA_NHANH_NGAY (mặc định 3) như ra_nhanh.sh.
"""
import argparse
import glob
import html
import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
from urllib.parse import parse_qs, urlsplit

HERE = os.path.dirname(os.path.abspath(__file__))
_common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=HERE,
                         capture_output=True, text=True).stdout.strip()
ROOT = os.path.dirname(_common) if _common else HERE   # luôn là cây chính, kể cả khi chạy từ worktree
BASE = os.environ.get("RA_NHANH_BASE", "develop")
NGAY = int(os.environ.get("RA_NHANH_NGAY", "3"))
PROJ = os.path.expanduser("~/.claude/projects")
OUT = os.path.join(ROOT, "output", "ra_nhanh.html")
DANG_LAM_PHUT = 30          # có hoạt động trong 30 phút gần nhất = đang làm
PHIEN_GIO = 24              # phiên Claude trong 24 giờ gần nhất
MA = re.compile(r"\b(?:WK|TT|GOV|CE|SYS|ORG|LRN|SCR|CMP|TPL|AIX|SEO|TOK)-\d+(?:\.\d+)?\b")
REPO_KEY = os.path.basename(ROOT)   # tên thư mục repo, lọc thư mục log phiên


def git(*args, cwd=ROOT, strip=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        return ""
    return r.stdout.strip() if strip else r.stdout.rstrip("\n")


def worktrees():
    out, cur = [], {}
    for line in git("worktree", "list", "--porcelain").splitlines() + [""]:
        if not line:
            if cur:
                out.append(cur)
            cur = {}
        elif line.startswith("worktree "):
            cur = {"path": line[9:], "branch": None}
        elif line.startswith("branch "):
            cur["branch"] = line[7:].removeprefix("refs/heads/")
        elif line == "detached":
            cur["detached"] = True
        elif line.startswith("locked"):
            cur["locked"] = True
    return out


def process_cwds():
    r = subprocess.run(["lsof", "-nP", "-d", "cwd", "-Fpcn"], capture_output=True, text=True)
    procs, cur = [], {}
    for line in r.stdout.splitlines():
        k, v = line[:1], line[1:]
        if k == "p":
            cur = {"pid": v}
        elif k == "c":
            cur["comm"] = v
        elif k == "n":
            procs.append({**cur, "cwd": v})
    return procs


def clean_prompt(text):
    text = re.sub(r"<(system-reminder|ide_[a-z_]+|command-[a-z-]+)[^>]*>.*?</\1>", " ", text, flags=re.S)
    text = re.sub(r"</?pasted_content[^>]*>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def read_session(path):
    s = {"file": path, "id": os.path.basename(path)[:-6], "mtime": os.path.getmtime(path),
         "title": "", "prompt": "", "cwds": [], "branch": ""}
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            t = d.get("type")
            if t in ("ai-title", "custom-title"):
                s["title"] = d.get("customTitle") or d.get("aiTitle") or s["title"]
            if d.get("cwd") and (not s["cwds"] or s["cwds"][-1] != d["cwd"]):
                s["cwds"].append(d["cwd"])
            if d.get("gitBranch"):
                s["branch"] = d["gitBranch"]
            if t == "user" and not s["prompt"]:
                c = (d.get("message") or {}).get("content")
                if isinstance(c, list):
                    c = " ".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
                if isinstance(c, str) and clean_prompt(c):
                    s["prompt"] = clean_prompt(c)[:220]
    return s


def sessions_and_agents():
    now, sess, agents = time.time(), [], []
    for d in glob.glob(os.path.join(PROJ, f"*{REPO_KEY}*")):
        for f in glob.glob(os.path.join(d, "*.jsonl")):
            if now - os.path.getmtime(f) < PHIEN_GIO * 3600:
                sess.append(read_session(f))
        for m in glob.glob(os.path.join(d, "*", "subagents", "*.meta.json")):
            j = m[:-10] + ".jsonl"
            mt = os.path.getmtime(j) if os.path.exists(j) else os.path.getmtime(m)
            try:
                meta = json.load(open(m, encoding="utf-8"))
            except ValueError:
                continue
            if meta.get("worktreePath"):
                agents.append({**meta, "mtime": mt, "parent": m.split(os.sep)[-3]})
    sess.sort(key=lambda s: -s["mtime"])
    return sess, agents


TIN_MOI_PHIEN = 120         # lưới trò chuyện: giữ bấy nhiêu tin cuối mỗi phiên
PHIEN_TOI_DA = 16           # lưới trò chuyện: tối đa bấy nhiêu phiên
_chat_cache = {}            # đường dẫn → (mtime, dữ liệu) — API gọi 5 giây/lần, chỉ đọc lại file đã đổi


def clean_text(text):
    """Như clean_prompt nhưng giữ xuống dòng để đọc lại nội dung."""
    text = re.sub(r"<(system-reminder|ide_[a-z_]+|command-[a-z-]+)[^>]*>.*?</\1>", "", text, flags=re.S)
    text = re.sub(r"</?pasted_content[^>]*>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def read_chat(path):
    """Tin người dùng + lời đáp của Claude (bỏ thinking, kết quả lệnh); lệnh gọi tool gộp thành một dòng."""
    mt = os.path.getmtime(path)
    hit = _chat_cache.get(path)
    if hit and hit[0] == mt:
        return hit[1]
    s = read_session(path)
    msgs = []
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            t, c = d.get("type"), (d.get("message") or {}).get("content")
            att = d.get("attachment") if t == "attachment" else None
            if isinstance(att, dict) and att.get("type") == "queued_command" and att.get("humanTurn"):
                t, c = "user", att.get("prompt")   # tin người dùng gửi chen khi Claude đang làm
            if t == "user" and not d.get("isMeta") and not d.get("isSidechain"):
                if isinstance(c, list):
                    c = "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
                text = clean_text(c) if isinstance(c, str) else ""
                if text:
                    msgs.append({"r": "user", "t": text, "ts": d.get("timestamp", "")})
            elif t == "assistant" and isinstance(c, list) and not d.get("isSidechain"):
                for x in c:
                    if not isinstance(x, dict):
                        continue
                    if x.get("type") == "text" and x.get("text", "").strip():
                        if msgs and msgs[-1]["r"] == "ai":
                            msgs[-1]["t"] += "\n\n" + x["text"].strip()
                        else:
                            msgs.append({"r": "ai", "t": x["text"].strip(), "ts": d.get("timestamp", "")})
                    elif x.get("type") == "tool_use":
                        name = re.sub(r"^mcp__[^_]+(?:_[^_]+)*?__", "", x.get("name", "?"))
                        if not (msgs and msgs[-1]["r"] == "tool"):
                            msgs.append({"r": "tool", "t": {}, "ts": d.get("timestamp", "")})
                        msgs[-1]["t"][name] = msgs[-1]["t"].get(name, 0) + 1
    for m in msgs:
        if m["r"] == "tool":
            m["t"] = ", ".join(f"{k} ×{v}" if v > 1 else k for k, v in m["t"].items())
    data = {"id": s["id"], "title": s["title"] or s["prompt"][:60] or "(chưa đặt tên)", "branch": s["branch"],
            "cwd": short(s["cwds"][-1]) if s["cwds"] else "", "mtime": mt, "n": len(msgs),
            "msgs": msgs[-TIN_MOI_PHIEN:]}
    _chat_cache[path] = (mt, data)
    return data


def chat_data(gio):
    now = time.time()
    files = [f for d in glob.glob(os.path.join(PROJ, f"*{REPO_KEY}*")) for f in glob.glob(os.path.join(d, "*.jsonl"))
             if now - os.path.getmtime(f) < gio * 3600]
    files.sort(key=lambda f: -os.path.getmtime(f))
    return {"now": now, "sessions": [read_chat(f) for f in files[:PHIEN_TOI_DA]]}


def inside(p, root):
    return p == root or p.startswith(root.rstrip("/") + "/")


def collect():
    now = time.time()
    wts = worktrees()
    main = wts[0]["path"] if wts else ROOT
    paths = sorted((w["path"] for w in wts), key=len, reverse=True)
    procs = process_cwds()
    sess, agents = sessions_and_agents()
    titles = {s["id"]: s["title"] or s["prompt"][:60] for s in sess}

    def owner(cwd):   # worktree sâu nhất chứa cwd
        return next((p for p in paths if inside(cwd, p)), None)

    rows = []
    for w in wts:
        p, b = w["path"], w.get("branch")
        r = {"path": p, "branch": b or "(tách rời)", "main": p == main, "exists": os.path.isdir(p)}
        r["procs"] = sorted({x.get("comm", "?") for x in procs if owner(x["cwd"]) == p})
        dirty, last_edit = [], 0
        if r["exists"]:
            for line in git("status", "--porcelain", cwd=p, strip=False).splitlines():
                code, f = line[:2], line[3:].split(" -> ")[-1].strip('"')
                dirty.append((code.strip() or "?", f))
                fp = os.path.join(p, f)
                if code != "??" and os.path.exists(fp):
                    last_edit = max(last_edit, os.path.getmtime(fp))
        r["dirty"] = [d for d in dirty if d[0] != "??"]
        r["untracked"] = [d for d in dirty if d[0] == "??"]
        r["last_edit"] = last_edit
        if b:
            r["ahead"] = int(git("rev-list", "--count", f"{BASE}..{b}") or 0)
            r["behind"] = int(git("rev-list", "--count", f"{b}..{BASE}") or 0)
            r["commits"] = [c.split("\x1f") for c in git("log", f"{BASE}..{b}", "-n", "8",
                                                           "--format=%h\x1f%ct\x1f%s").splitlines()]
            r["last_commit"] = int(git("log", "-1", "--format=%ct", b) or 0)
            r["last_subject"] = git("log", "-1", "--format=%s", b)
            r["note"] = git("config", f"branch.{b}.description")
            reflog = git("log", "-g", "-1", "--format=%ct", f"refs/heads/{b}")
            r["touched"] = int(reflog or r["last_commit"] or 0)
        else:
            r.update(ahead=0, behind=0, commits=[], last_commit=0, last_subject="", note="", touched=0)
        r["agents"] = [a for a in agents if a["worktreePath"] == p]
        for a in r["agents"]:
            a["parent_title"] = titles.get(a["parent"], "")
        r["sessions"] = [s for s in sess if not r["main"] and (
            any(inside(c, p) for c in s["cwds"]) or (b and s["branch"] == b))]
        seen = [r["last_edit"]] + [a["mtime"] for a in r["agents"]] + [s["mtime"] for s in r["sessions"]]
        r["active_at"] = max(seen)
        text = " ".join([r["last_subject"], r["note"]] + [c[2] for c in r["commits"]]
                        + [a.get("description", "") for a in r["agents"]])
        r["codes"] = sorted(set(MA.findall(text)))
        age = (now - r["last_commit"]) / 86400 if r["last_commit"] else 0
        if r["main"]:
            r["state"] = "chinh"
        elif r["procs"] or now - r["active_at"] < DANG_LAM_PHUT * 60:
            r["state"] = "dang-lam"
        elif not b:
            r["state"] = "tach-roi"
        elif r["ahead"]:
            r["state"] = "bo-quen" if (not r["note"] and age > NGAY) else "chua-merge"
        elif r["dirty"]:
            r["state"] = "sua-do"
        elif now - r["touched"] < 86400:
            r["state"] = "moi-tao"
        else:
            r["state"] = "cho-don"
        rows.append(r)

    wt_branches = {w.get("branch") for w in wts}
    loose = []
    for b in git("for-each-ref", "--format=%(refname:short)", "refs/heads").splitlines():
        if b in (BASE, "main") or b in wt_branches:
            continue
        n = int(git("rev-list", "--count", f"{BASE}..{b}") or 0)
        if n:
            loose.append({"branch": b, "ahead": n, "last_subject": git("log", "-1", "--format=%s", b),
                          "last_commit": int(git("log", "-1", "--format=%ct", b) or 0),
                          "note": git("config", f"branch.{b}.description")})
    merged_loose = len([b for b in git("branch", "--merged", BASE, "--format=%(refname:short)").splitlines()
                        if b not in (BASE, "main") and b not in wt_branches])
    merges = [m.split("\x1f") for m in git("log", BASE, "--merges", "--first-parent", "-n", "15",
                                           "--format=%h\x1f%ct\x1f%s").splitlines()]
    return {"now": now, "rows": rows, "loose": loose, "merged_loose": merged_loose, "merges": merges,
            "sessions": sess, "base": BASE, "base_head": git("log", "-1", "--format=%h %s", BASE),
            "main_branch": git("branch", "--show-current")}


# ---------- HTML ----------
CSS = r''':root{--bg:#f6f7f9;--card:#fff;--fg:#1c2230;--mute:#5b6475;--line:#d9dde4;--live:#0f7b3f;--live-bg:#e3f5ea;
--warn:#8a5a00;--warn-bg:#fdf1d8;--bad:#b42318;--bad-bg:#fde7e5;--info:#1d4ed8;--info-bg:#e5edff;--mute-bg:#eceef2}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#12151b;--card:#1b2029;--fg:#e6e9ef;--mute:#9aa3b2;
--line:#2c333f;--live:#5fd08f;--live-bg:#15321f;--warn:#f0c060;--warn-bg:#3a2d10;--bad:#ff8a80;--bad-bg:#3d1a17;
--info:#8fb2ff;--info-bg:#1a2644;--mute-bg:#262c37}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 12px}
.sub,.path{color:var(--mute);font-size:13px}.stats{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 16px;min-width:140px}
.stat b{display:block;font-size:22px}.stat.live b{color:var(--live)}.stat.warn b{color:var(--warn)}.stat.bad b{color:var(--bad)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}
.card.s-dang-lam{border-color:var(--live);box-shadow:0 0 0 1px var(--live) inset}.card.s-bo-quen{border-color:var(--bad)}
.card header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.card h3{margin:0;font-size:15px;word-break:break-all}.path{word-break:break-all}
.pill{white-space:nowrap;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px}
.pill.live{color:var(--live);background:var(--live-bg)}.pill.warn{color:var(--warn);background:var(--warn-bg)}
.pill.bad{color:var(--bad);background:var(--bad-bg)}.pill.info{color:var(--info);background:var(--info-bg)}.pill.mute{color:var(--mute);background:var(--mute-bg)}
.facts{margin:8px 0;font-size:13px}.codes code{margin-right:4px}code{background:var(--mute-bg);border-radius:4px;padding:0 4px;font-size:12px}
.task{margin:6px 0;font-size:14px}.lbl{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--info);margin-right:4px}
.quote{color:var(--mute);font-size:13px}details{margin-top:6px;font-size:13px}summary{cursor:pointer;color:var(--info)}
ul{margin:6px 0;padding-left:18px}table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;font-size:13px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-weight:600}
.wrap{overflow-x:auto}.empty{color:var(--mute)}.nav{margin:0 0 6px;font-size:14px}a{color:var(--info)}
.chat-strip{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;align-items:flex-start}
.chat-strip .chat{flex:0 0 auto;width:420px;max-width:calc(100vw - 32px);resize:both}
.chat-grid{display:grid;grid-template-columns:repeat(var(--cot,auto-fill),minmax(340px,1fr));gap:12px}
.chat{background:var(--card);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;
height:var(--cao,560px);min-height:200px;min-width:280px;resize:vertical;overflow:hidden}
.chat.live{border-color:var(--live);box-shadow:0 0 0 1px var(--live) inset}.chat-grid .chat.to{grid-column:1/-1}.chat-strip .chat.to{width:calc(100vw - 64px)}
.chat>header{padding:10px 12px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.chat h3{margin:0;font-size:14px;overflow-wrap:anywhere}.chat .meta{font-size:12px;color:var(--mute);overflow-wrap:anywhere}
.chat button{font:inherit;font-size:12px;background:var(--mute-bg);color:var(--fg);border:0;border-radius:6px;padding:2px 8px;cursor:pointer}
.chat .body{flex:1;overflow:auto;padding:8px 12px;font-size:13px}
.m{margin:8px 0}.m .who{display:block;font-size:11px;font-weight:700;color:var(--mute)}
.m.user .txt{background:var(--info-bg);border-radius:8px;padding:6px 10px}.m .txt{white-space:pre-wrap;overflow-wrap:anywhere}
.m.tool{font-size:12px;color:var(--mute);margin:4px 0}.m pre{white-space:pre;overflow-x:auto;background:var(--mute-bg);border-radius:6px;padding:6px 8px;margin:4px 0;font-size:12px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--live);margin-right:4px}
.ctrl{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:8px 0 12px;font-size:14px}.ctrl select{font:inherit}
'''
CHAT_JS = r'''
var PHIEN = document.getElementById('phien'), DA_VE = {}, LAN_DAU = true;
function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
function md(t) {   // markdown tối thiểu: khối ``` , `mã`, **đậm**, # tiêu đề — escape trước rồi mới gắn thẻ
  return t.split(/```[^\n]*\n?/).map(function (p, i) {
    if (i % 2) return '<pre>' + esc(p.replace(/\n$/, '')) + '</pre>';
    return esc(p).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/^#{1,6} (.*)$/gm, '<b>$1</b>');
  }).join('');
}
function gioPhut(ts) { if (!ts) return ''; var d = new Date(ts);
  return d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) + ' ' + d.getDate() + '/' + (d.getMonth() + 1); }
function truoc(s) { s = Math.max(0, s); return s < 90 ? 'vừa xong' : s < 3600 ? Math.floor(s / 60) + ' phút trước'
  : s < 86400 ? Math.floor(s / 3600) + ' giờ trước' : Math.floor(s / 86400) + ' ngày trước'; }
function taoThe(s) {
  var el = document.createElement('article');
  el.className = 'chat'; el.id = 'c-' + s.id;
  el.innerHTML = '<header><div><h3></h3><div class="meta"></div></div><button type="button" title="Phóng / thu">⤢</button></header><div class="body"></div>';
  el.querySelector('button').onclick = function () { el.classList.toggle('to'); };
  return el;
}
function veThe(el, s, now) {
  el.querySelector('h3').textContent = s.title;
  var live = now - s.mtime < 120;
  el.classList.toggle('live', live);
  el.querySelector('.meta').innerHTML = (live ? '<span class="dot"></span>' : '') + esc(truoc(now - s.mtime)) +
    (s.branch ? ' · <code>' + esc(s.branch) + '</code>' : '') + ' · ' + esc(s.cwd) + ' · ' + s.n + ' tin' +
    (s.n > s.msgs.length ? ' (hiện ' + s.msgs.length + ' tin cuối)' : '');
  if (DA_VE[s.id] === s.mtime) return;
  var body = el.querySelector('.body'), cuoi = DA_VE[s.id] === undefined || body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  body.innerHTML = s.msgs.map(function (m) {
    if (m.r === 'tool') return '<div class="m tool">⚙ ' + esc(m.t) + '</div>';
    return '<div class="m ' + m.r + '"><span class="who">' + (m.r === 'user' ? 'Anh' : 'Claude') + ' · ' + gioPhut(m.ts) +
      '</span><div class="txt">' + md(m.t) + '</div></div>';
  }).join('') || '<p class="empty">Chưa có tin.</p>';
  if (cuoi) body.scrollTop = body.scrollHeight;   // đang ở cuối thì bám cuối; đang đọc giữa chừng thì giữ nguyên
  DA_VE[s.id] = s.mtime;
}
function napPhien() {
  fetch('/api/tro-chuyen?gio=' + PHIEN.dataset.gio, {cache: 'no-store'}).then(function (r) { return r.json(); }).then(function (d) {
    var bang = document.getElementById('phien-bang'); if (bang) bang.hidden = true;
    var con = {};
    d.sessions.forEach(function (s) {
      var el = document.getElementById('c-' + s.id);
      if (!el) { el = taoThe(s); if (LAN_DAU) PHIEN.appendChild(el); else PHIEN.insertBefore(el, PHIEN.firstChild); }
      con[el.id] = 1; veThe(el, s, d.now);
    });   // thứ tự giữ cố định sau lần đầu để thẻ không nhảy chỗ khi đang đọc; phiên mới chen lên đầu
    Array.prototype.slice.call(PHIEN.children).forEach(function (c) { if (!con[c.id]) { c.remove(); delete DA_VE[c.id.slice(2)]; } });
    document.getElementById('phien-dem').textContent = d.sessions.length;
    LAN_DAU = false;
  }).catch(function () {});
}
napPhien(); setInterval(napPhien, 5000);
function lamMoiKhung(lap) {   // trang chính: thay phần trên / dưới mà không tải lại, dải thẻ giữ nguyên chỗ cuộn
  if (!lap) return;
  setInterval(function () {
    fetch('/', {cache: 'no-store'}).then(function (r) { return r.text(); }).then(function (t) {
      var doc = new DOMParser().parseFromString(t, 'text/html');
      ['khung-tren', 'khung-duoi'].forEach(function (id) { var a = document.getElementById(id), b = doc.getElementById(id); if (a && b) a.innerHTML = b.innerHTML; });
    }).catch(function () {});
  }, lap * 1000);
}
function doc(k) { try { return localStorage.getItem('ra_nhanh.' + k); } catch (e) { return null; } }
function ghi(k, v) { try { localStorage.setItem('ra_nhanh.' + k, v); } catch (e) {} }
function chonLuoi() {
  [['cot', function (v) { PHIEN.style.setProperty('--cot', v || 'auto-fill'); }],
   ['cao', function (v) { PHIEN.style.setProperty('--cao', v); }],
   ['gio', function (v) { PHIEN.dataset.gio = v; napPhien(); }]].forEach(function (x) {
    var sel = document.getElementById(x[0]), v = doc(x[0]);
    if (v !== null) sel.value = v;
    x[1](sel.value);
    sel.onchange = function () { ghi(x[0], sel.value); x[1](sel.value); };
  });
}
'''
PHUC_VU = False     # True khi chạy --cong: trang dùng JS thay meta refresh, lấy trò chuyện qua /api/tro-chuyen
def ago(ts, now):
    if not ts:
        return "—"
    s = max(0, now - float(ts))
    if s < 90:
        return "vừa xong"
    if s < 3600:
        return f"{int(s // 60)} phút trước"
    if s < 86400:
        return f"{int(s // 3600)} giờ trước"
    return f"{int(s // 86400)} ngày trước"


E = html.escape
NHAN = {
    "dang-lam": ("Đang làm", "live"), "chua-merge": ("Chưa merge", "warn"), "bo-quen": ("Bỏ quên?", "bad"),
    "sua-do": ("Đã merge, còn sửa chưa commit", "warn"), "moi-tao": ("Mới tạo, chưa commit", "info"),
    "cho-don": ("Đã merge — chờ dọn", "mute"), "tach-roi": ("Tách rời (detached)", "mute"), "chinh": ("Cây chính", "info"),
}


def pill(state):
    t, k = NHAN[state]
    return f'<span class="pill {k}">{E(t)}</span>'


def short(p):
    return p.replace(ROOT + "/.claude/worktrees/", "…/worktrees/").replace(os.path.expanduser("~"), "~")


def card(r, now):
    h = [f'<article class="card s-{r["state"]}"><header><div><h3>{E(r["branch"])}</h3>'
         f'<div class="path">{E(short(r["path"]))}</div></div>{pill(r["state"])}</header>']
    facts = []
    if r["branch"] != "(tách rời)":
        facts.append(f'<b>{r["ahead"]}</b> commit chưa vào {E(BASE)}')
        if r["behind"]:
            facts.append(f'{E(BASE)} đi trước <b>{r["behind"]}</b>')
    if r["dirty"]:
        facts.append(f'<b>{len(r["dirty"])}</b> file sửa chưa commit')
    if r["untracked"]:
        facts.append(f'{len(r["untracked"])} file mới chưa track')
    facts.append(f'hoạt động {ago(r["active_at"] or r["last_commit"], now)}')
    if r["procs"]:
        facts.append("tiến trình: " + E(", ".join(r["procs"][:4])))
    h.append('<p class="facts">' + " · ".join(facts) + "</p>")
    if r["codes"]:
        h.append('<p class="codes">' + "".join(f"<code>{E(c)}</code>" for c in r["codes"]) + "</p>")
    for a in r["agents"]:
        h.append(f'<p class="task"><span class="lbl">Agent nền</span> {E(a.get("description", ""))}'
                 f'<span class="sub"> — do phiên «{E(a.get("parent_title") or a["parent"][:8])}» giao, '
                 f'{ago(a["mtime"], now)}</span></p>')
    for s in r["sessions"][:3]:
        h.append(f'<p class="task"><span class="lbl">Phiên</span> {E(s["title"] or "(chưa đặt tên)")}'
                 f'<span class="sub"> — {ago(s["mtime"], now)}</span><br><span class="quote">{E(s["prompt"])}</span></p>')
    if r["note"]:
        h.append(f'<p class="task"><span class="lbl">Ghi chú</span> {E(r["note"])}</p>')
    if r["commits"]:
        h.append('<details><summary>Commit chưa vào ' + E(BASE) + f' ({r["ahead"]})</summary><ul>'
                 + "".join(f'<li><code>{E(c[0])}</code> {E(c[2])} <span class="sub">{ago(c[1], now)}</span></li>'
                           for c in r["commits"]) + "</ul></details>")
    elif r["last_subject"]:
        h.append(f'<p class="sub">Commit cuối: {E(r["last_subject"])}</p>')
    if r["dirty"]:
        h.append(f'<details><summary>File đang sửa ({len(r["dirty"])})</summary><ul>'
                 + "".join(f"<li><code>{E(c)}</code> {E(f)}</li>" for c, f in r["dirty"][:20]) + "</ul></details>")
    h.append("</article>")
    return "".join(h)


def render(d, lap):
    now, rows = d["now"], d["rows"]
    by = lambda *st: [r for r in rows if r["state"] in st]
    dang, cho, don = by("dang-lam"), by("bo-quen", "chua-merge", "sua-do", "moi-tao"), by("cho-don", "tach-roi")
    main = by("chinh")
    n_bq = len(by("bo-quen")) + len([x for x in d["loose"] if not x["note"] and (now - x["last_commit"]) / 86400 > NGAY])
    stats = [("Đang làm", len(dang), "live"), ("Chưa merge", len(by("chua-merge", "sua-do", "moi-tao")) + len(d["loose"]), "warn"),
             ("Bỏ quên?", n_bq, "bad"), ("Chờ dọn", f'{len(don)} wt + {d["merged_loose"]} nhánh', "mute")]
    refresh = f'<meta http-equiv="refresh" content="{lap}">' if lap and not PHUC_VU else ""
    o = [f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">{refresh}<title>Theo dõi worktree</title><style>
{CSS}</style></head><body><main>
<h1>Theo dõi worktree và nhánh</h1>{'<p class="nav"><b>Worktree</b> · <a href="/tro-chuyen">Trò chuyện — lưới các phiên Claude</a></p><div id="khung-tren">' if PHUC_VU else ''}
<div class="sub">Dựng lúc {time.strftime('%H:%M:%S %d/%m/%Y', time.localtime(now))}{f' · tự tải lại mỗi {lap} giây' if lap else ' · chạy lại <code>python3 ra_nhanh.py</code> để cập nhật'} · {E(d['base'])} @ <code>{E(d['base_head'][:90])}</code> · cây chính đang ở <code>{E(d['main_branch'])}</code></div>
<div class="stats">""" + "".join(f'<div class="stat {k}"><b>{v}</b>{E(t)}</div>' for t, v, k in stats) + "</div>"]

    o.append(f"<h2>Đang làm ({len(dang)})</h2><p class='sub'>Có tiến trình đứng trong worktree, file sửa, phiên hoặc agent hoạt động trong {DANG_LAM_PHUT} phút gần nhất.</p>")
    o.append('<div class="grid">' + ("".join(card(r, now) for r in sorted(dang, key=lambda r: -r["active_at"]))
                                   or '<p class="empty">Không có worktree nào đang hoạt động.</p>') + "</div>")
    o.append(f"<h2>Còn việc chưa vào {E(d['base'])} ({len(cho) + len(d['loose'])})</h2>")
    order = {"bo-quen": 0, "sua-do": 1, "chua-merge": 2, "moi-tao": 3}
    o.append('<div class="grid">' + ("".join(card(r, now) for r in sorted(cho, key=lambda r: order[r["state"]]))
                                   or '<p class="empty">Không có.</p>') + "</div>")
    if d["loose"]:
        o.append("<h2>Nhánh chưa merge, không có worktree</h2><div class='wrap'><table><tr><th>Nhánh</th><th>Commit</th><th>Lần cuối</th><th>Lý do / commit cuối</th></tr>"
                 + "".join(f"<tr><td>{E(x['branch'])}</td><td>{x['ahead']}</td><td>{ago(x['last_commit'], now)}</td><td>{E(x['note'] or x['last_subject'])}</td></tr>" for x in d["loose"])
                 + "</table></div>")

    # Phiên Claude: khi phục vụ qua --cong, JS thay bảng bằng dải thẻ trò chuyện (kéo ngang giữa phiên, cuộn dọc trong thẻ)
    o.append('</div>' if PHUC_VU else "")
    o.append(f"<h2>Phiên Claude {PHIEN_GIO} giờ qua (<span id='phien-dem'>{len(d['sessions'])}</span>)</h2>"
             + ("<p class='sub'>Kéo ngang để chuyển phiên, cuộn dọc trong thẻ để đọc; kéo góc dưới phải để giãn thẻ. "
                "Tự cập nhật mỗi 5 giây. Xem toàn màn hình: <a href='/tro-chuyen'>lưới trò chuyện</a>.</p>"
                f"<div id='phien' class='chat-strip' data-gio='{PHIEN_GIO}'></div>" if PHUC_VU else "")
             + "<div id='phien-bang' class='wrap'><table><tr><th>Phiên</th><th>Hoạt động</th><th>Nhánh / thư mục cuối</th><th>Yêu cầu đầu tiên</th></tr>")
    for s in d["sessions"][:25]:
        o.append(f"<tr><td>{E(s['title'] or '(chưa đặt tên)')}</td><td>{ago(s['mtime'], now)}</td>"
                 f"<td><code>{E(s['branch'])}</code><br><span class='sub'>{E(short(s['cwds'][-1]) if s['cwds'] else '')}</span></td>"
                 f"<td class='quote'>{E(s['prompt'][:160])}</td></tr>")
    o.append("</table></div>")
    o.append('<div id="khung-duoi">' if PHUC_VU else "")

    o.append(f"<h2>Merge gần đây vào {E(d['base'])}</h2><div class='wrap'><table><tr><th>Commit</th><th>Lúc</th><th>Nội dung</th></tr>"
             + "".join(f"<tr><td><code>{E(m[0])}</code></td><td>{ago(m[1], now)}</td><td>{E(m[2])}</td></tr>" for m in d["merges"])
             + "</table></div>")

    o.append(f"<h2>Đã merge — chờ dọn ({len(don)} worktree, {d['merged_loose']} nhánh không worktree)</h2>"
             "<p class='sub'>Dọn bằng <code>bash ra_nhanh.sh --don</code> (giữ lại worktree còn sửa, nhánh mới dùng trong 24 giờ).</p>"
             "<details><summary>Xem danh sách</summary><div class='wrap'><table><tr><th>Nhánh</th><th>Worktree</th><th>Commit cuối</th></tr>"
             + "".join(f"<tr><td>{E(r['branch'])}</td><td class='sub'>{E(short(r['path']))}</td><td>{E(r['last_subject'][:80])} <span class='sub'>{ago(r['last_commit'], now)}</span></td></tr>" for r in don)
             + "</table></div></details>")
    if main:
        r = main[0]
        o.append(f"<h2>Cây chính</h2><p>{E(short(r['path']))} ở <code>{E(r['branch'])}</code> · {len(r['dirty'])} file sửa chưa commit · {len(r['untracked'])} file chưa track</p>")
    if PHUC_VU:
        o.append(f"</div><script>{CHAT_JS}\nlamMoiKhung({lap});</script>")
    o.append("</main></body></html>")
    return "".join(o)


def render_chat_page():
    return f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Trò chuyện Claude</title><style>
{CSS}main{{max-width:none}}</style></head><body><main>
<h1>Trò chuyện — các phiên Claude</h1>
<p class="nav"><a href="/">Worktree</a> · <b>Trò chuyện</b></p>
<div class="ctrl"><label>Số cột <select id="cot"><option value="">Tự động</option><option>1</option><option>2</option>
<option>3</option><option>4</option></select></label>
<label>Cao thẻ <select id="cao"><option value="420px">Thấp</option><option value="600px">Vừa</option>
<option value="calc(100vh - 170px)">Đầy màn hình</option></select></label>
<label>Trong <select id="gio"><option value="1">1 giờ</option><option value="6">6 giờ</option>
<option value="24">24 giờ</option></select></label>
<span class="sub">Tự cập nhật mỗi 5 giây · <span id="phien-dem">…</span> phiên · bấm ⤢ để phóng một thẻ ra hết hàng</span></div>
<div id="phien" class="chat-grid" data-gio="6"></div>
<script>{CHAT_JS}
chonLuoi();</script></main></body></html>"""


def build(lap):
    d = collect()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(render(d, lap))
    os.replace(tmp, OUT)
    return d


class _Trang(BaseHTTPRequestHandler):
    """Trả output/ra_nhanh.html, /tro-chuyen, /api/tro-chuyen; chỉ cho Host 127.0.0.1 / localhost (chống DNS rebinding)."""
    def log_message(self, *a):
        pass

    def gui(self, body, kieu="text/html; charset=utf-8"):
        self.send_response(200)
        self.send_header("Content-Type", kieu)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlsplit(self.path)
        if self.headers.get("Host", "").split(":")[0] not in ("127.0.0.1", "localhost"):
            self.send_error(404)
        elif u.path in ("/", "/index.html"):
            with open(OUT, "rb") as f:
                self.gui(f.read())
        elif u.path == "/tro-chuyen":
            self.gui(render_chat_page().encode())
        elif u.path == "/api/tro-chuyen":
            try:
                gio = min(max(float(parse_qs(u.query).get("gio", ["6"])[0]), 0.1), 24 * 7)
            except ValueError:
                gio = 6
            self.gui(json.dumps(chat_data(gio), ensure_ascii=False).encode(), "application/json; charset=utf-8")
        else:
            self.send_error(404)


def main():
    ap = argparse.ArgumentParser(description="Bảng theo dõi worktree / nhánh / phiên Claude")
    ap.add_argument("--mo", action="store_true", help="mở trình duyệt sau khi dựng")
    ap.add_argument("--lap", type=int, default=0, help="dựng lại mỗi N giây (trang tự tải lại)")
    ap.add_argument("--cong", type=int, default=0, help="phục vụ trang qua http://127.0.0.1:<cổng> (mở trong VS Code Simple Browser)")
    a = ap.parse_args()
    if a.cong and not a.lap:
        a.lap = 30
    global PHUC_VU
    PHUC_VU = bool(a.cong)
    d = build(a.lap)
    dang = [r["branch"] for r in d["rows"] if r["state"] == "dang-lam"]
    print(f"{OUT} — đang làm: {', '.join(dang) or 'không'}")
    url = OUT
    if a.cong:
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", a.cong), _Trang)
        except OSError:
            raise SystemExit(f"Cổng {a.cong} đang bận — có thể trang đã chạy rồi: mở http://127.0.0.1:{a.cong}")
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{a.cong}"
        print(f"Trang: {url}  — VS Code: Cmd+Shift+P → Simple Browser: Show → dán địa chỉ. Ctrl+C để tắt")
    if a.mo:
        subprocess.run(["open", url])
    while a.lap:
        time.sleep(a.lap)
        build(a.lap)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
