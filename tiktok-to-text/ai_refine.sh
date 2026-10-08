#!/usr/bin/env bash
# Cho Claude (tài khoản Claude Pro/Max — không cần ANTHROPIC_API_KEY) tham gia tinh chế hàng "Chờ AI".
#   bash ai_refine.sh            -> 2 phiên song song, mỗi phiên làm tới khi hết hàng chờ
#   bash ai_refine.sh 4          -> 4 phiên song song
#   bash ai_refine.sh 2 5        -> 2 phiên, mỗi phiên tối đa 5 lượt (mỗi lượt làm xong 1 tài liệu)
# Cần: app đang chạy (bash start_web.sh) và Claude Code đã nối MCP vc-content (claude mcp get vc-content).
# Các phiên nhận việc qua claim_documents nên không làm trùng nhau / trùng máy chủ. Ctrl+C để dừng.
# Claude hết quota (giới hạn gói Pro/Max) -> dừng mọi phiên, trả tài liệu đang dở về hàng "Chờ AI" để máy chủ làm
# tiếp (Claude API, hết quota nữa thì AI local Ollama). QUOTA_WAIT=phút: chờ rồi chạy lại thay vì dừng hẳn.
set -e
cd "$(dirname "$0")"

WORKERS=${1:-2}
ROUNDS=${2:-1000}
MODEL=${CLAUDE_MODEL:-sonnet}
QUOTA_WAIT=${QUOTA_WAIT:-0}
QUOTA_RE='usage limit|hit your limit|limit reached|limit will reset|resets at|credit balance|rate_limit_error|overloaded'
STOP=output/ai_refine/.quota
mkdir -p output/ai_refine
rm -f "$STOP"

if ! claude mcp get vc-content >/dev/null 2>&1; then
  echo "Claude Code chưa nối MCP vc-content. Tạo token ở trang 'Kết nối AI' rồi chạy:"
  echo '  claude mcp add -s user --transport http vc-content http://localhost:8000/mcp --header "Authorization: Bearer vcmcp_..."'
  exit 1
fi

PROMPT='Dùng MCP vc-content. Làm đúng MỘT tài liệu rồi dừng: gọi list_categories, rồi claim_documents(limit=1).
Nếu claimed rỗng: in đúng dòng "HET_HANG_CHO" và dừng.
get_document đọc hết (theo next_offset); search_cards chống trùng; create_card từng thẻ, luôn kèm document_id và
ai_model (tên model của bạn) — mỗi thẻ một ý, chỉ ghi điều có trong tài liệu, evidence trích nguyên văn ngắn,
categories dùng slug có trong cây, 2–8 thẻ; có cards_done thì chỉ làm phần còn thiếu. Xong thì BẮT BUỘC
mark_document status=done kèm summary và ai_model (không có gì đáng giữ: vẫn done, summary nêu lý do).
Không làm được: mark_document status=pending. Cuối cùng in một dòng: tên tài liệu, số thẻ tạo, pending_left.'

release_claims() {
  local n
  n=$(cd backend && ../.venv/bin/python scripts/release_claims.py 2>/dev/null) || n="?"
  echo "Đã trả $n tài liệu đang dở về hàng Chờ AI."
}

run_worker() {
  local id=$1 log="output/ai_refine/worker$1.log" code
  for ((r = 1; r <= ROUNDS; r++)); do
    [[ -f "$STOP" ]] && return
    echo "[worker $id] lượt $r…"
    code=0
    out=$(claude -p "$PROMPT" --model "$MODEL" --allowedTools "mcp__vc-content" 2>&1) || code=$?
    printf '%s\n--- %s lượt %s (exit %s)\n%s\n' "$(date '+%F %T')" "$id" "$r" "$code" "$out" >> "$log"
    echo "[worker $id] $(echo "$out" | tail -1)"
    [[ "$out" == *HET_HANG_CHO* ]] && { echo "[worker $id] hết hàng chờ."; return; }
    if echo "$out" | grep -qiE "$QUOTA_RE"; then
      echo "[worker $id] Claude hết quota: $(echo "$out" | grep -iE "$QUOTA_RE" | head -1)"
      touch "$STOP"
      return
    fi
  done
}

trap 'release_claims; kill 0' INT TERM
while :; do
  echo "Chạy $WORKERS phiên Claude ($MODEL) — log ở output/ai_refine/"
  for ((w = 1; w <= WORKERS; w++)); do run_worker "$w" & sleep 2; done
  wait
  [[ -f "$STOP" ]] || break
  release_claims
  echo "Hàng chờ còn lại do máy chủ xử lý (Claude API / AI local Ollama)."
  ((QUOTA_WAIT > 0)) || break
  echo "Chờ $QUOTA_WAIT phút rồi thử Claude lại… (Ctrl+C để dừng)"
  sleep $((QUOTA_WAIT * 60))
  rm -f "$STOP"
done
