#!/usr/bin/env bash
# Rà nhánh + worktree so với develop (DESIGN Phần 0 mục 0.8.4): nhánh nào còn việc chưa merge, bỏ quên bao lâu,
# worktree nào đã merge xong cần dọn. Chỉ đọc, trừ --don / --ghi.
#   bash ra_nhanh.sh                      bảng đầy đủ
#   bash ra_nhanh.sh --ngan               tóm tắt vài dòng (hook đầu phiên Claude Code); không có gì thì im
#   bash ra_nhanh.sh --don                xoá worktree + nhánh ĐÃ merge (worktree còn sửa / file lạ thì git tự từ chối, giữ lại)
#   bash ra_nhanh.sh --ghi <nhánh> "<đang chờ gì>"   ghi lý do nhánh còn để dở (git config branch.<nhánh>.description)
#   bash ra_nhanh.sh --xem                MỘT LỆNH: bật trang theo dõi chạy nền (nếu chưa chạy) rồi mở cửa sổ trình duyệt
#                                         http://127.0.0.1:8900 — worktree đang làm, agent nền + việc được giao, phiên Claude,
#                                         merge gần đây; tự dựng lại mỗi 30 giây. Chạy lại lệnh chỉ mở thêm cửa sổ, không bật trùng.
#                                         Nội dung trò chuyện các phiên: dải thẻ trên trang + lưới /tro-chuyen (5 giây/lần).
#   bash ra_nhanh.sh --xem-tat            tắt trang chạy nền
# Nhánh gốc: RA_NHANH_BASE (mặc định develop). Để dở quá RA_NHANH_NGAY ngày (mặc định 3) mà không ghi lý do → «bỏ quên?».
# Nhánh chưa có commit riêng nhưng mới tạo / mới đổi trong 24 giờ coi là đang dùng (phiên khác vừa mở), không dọn.
cd "$(dirname "$0")" || exit 1
BASE="${RA_NHANH_BASE:-develop}"
NGAY="${RA_NHANH_NGAY:-3}"
MODE="${1:-bang}"
MAIN_WT="$(git worktree list --porcelain | awk '/^worktree/{print $2; exit}')"
NOW=$(date +%s)

PORT="${RA_NHANH_PORT:-8900}"
URL="http://127.0.0.1:$PORT"
if [[ "$MODE" == "--xem" ]]; then
  if ! curl -sf -o /dev/null "$URL/"; then
    mkdir -p output/logs
    nohup python3 ra_nhanh.py --cong "$PORT" --lap "${2:-30}" >>output/logs/ra_nhanh.log 2>&1 &
    for _ in $(seq 1 20); do curl -sf -o /dev/null "$URL/" && break; sleep 0.5; done
    curl -sf -o /dev/null "$URL/" || { echo "Không bật được trang — xem output/logs/ra_nhanh.log"; exit 1; }
    echo "Đã bật trang chạy nền (tắt: bash ra_nhanh.sh --xem-tat)"
  fi
  open "$URL"
  echo "Đang mở $URL — trong VS Code: Cmd+Shift+P → Simple Browser: Show → dán địa chỉ này"
  exit 0
fi
if [[ "$MODE" == "--xem-tat" ]]; then
  pkill -f "ra_nhanh.py --cong $PORT" && echo "Đã tắt trang $URL" || echo "Trang không chạy"
  exit 0
fi

if [[ "$MODE" == "--ghi" ]]; then
  [[ -n "$2" && -n "$3" ]] || { echo "Dùng: bash ra_nhanh.sh --ghi <nhánh> \"<đang chờ gì>\""; exit 2; }
  git rev-parse --verify -q "refs/heads/$2" >/dev/null || { echo "Không có nhánh $2"; exit 2; }
  git config "branch.$2.description" "$3 ($(date +%d/%m))" && echo "Đã ghi: $2 — $3"
  exit 0
fi

# worktree -> nhánh (bash 3.2: không mảng kết hợp, dùng chuỗi "đường_dẫn<TAB>nhánh" mỗi dòng)
WT_LIST="$(git worktree list --porcelain | awk '
  /^worktree/{w=substr($0,10)} /^branch/{b=$2; sub("refs/heads/","",b); print w"\t"b}')"
vua_dung() { local t; t=$(git log -g -1 --format=%ct "refs/heads/$1" 2>/dev/null); [[ -n "$t" ]] && (( NOW - t < 86400 )); }
wt_of() { printf '%s\n' "$WT_LIST" | awk -F'\t' -v b="$1" '$2==b{print $1; exit}'; }
dirty_of() {
  if [[ -n "$1" && -d "$1" ]]; then git -C "$1" status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' '
  else echo 0; fi
}

cho=""; boquen=0; chomerge=0; don_wt=0; don_br=0; don_ban=""
for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
  [[ "$b" == "$BASE" || "$b" == main ]] && continue
  wt="$(wt_of "$b")"
  ahead=$(git rev-list --count "$BASE..$b")
  if (( ahead == 0 )); then
    vua_dung "$b" && continue
    if [[ -n "$wt" && "$wt" != "$MAIN_WT" ]]; then
      d=$(dirty_of "$wt")
      if (( d > 0 )); then don_ban+="  $b — $d file sửa chưa commit ở $wt"$'\n'
      else don_wt=$((don_wt+1)); fi
    elif [[ -z "$wt" ]]; then don_br=$((don_br+1)); fi
    continue
  fi
  chomerge=$((chomerge+1))
  tuoi=$(( (NOW - $(git log -1 --format=%ct "$b")) / 86400 ))
  ghi="$(git config "branch.$b.description" 2>/dev/null | head -1)"
  nhan=""
  if [[ -z "$ghi" ]] && (( tuoi > NGAY )); then nhan="BỎ QUÊN?"; boquen=$((boquen+1)); fi
  d=$(dirty_of "$wt")
  cho+="$(printf '%-9s %-44s %3s commit  %3s ngày  sửa:%-3s %s' "$nhan" "$b" "$ahead" "$tuoi" "$d" \
        "${ghi:-$(git log -1 --format=%s "$b" | cut -c1-60)}")"$'\n'
done

if [[ "$MODE" == "--ngan" ]]; then
  (( chomerge + don_wt + don_br == 0 )) && [[ -z "$don_ban" ]] && exit 0
  echo "[ra_nhanh] $chomerge nhánh chưa merge $BASE ($boquen bỏ quên?), $don_wt worktree + $don_br nhánh đã merge chờ dọn. Xem: bash ra_nhanh.sh"
  printf '%s' "$cho" | sed 's/  */ /g; s/^ //; s/^/  /'
  exit 0
fi

if [[ "$MODE" == "--don" ]]; then
  for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
    [[ "$b" == "$BASE" || "$b" == main ]] && continue
    (( $(git rev-list --count "$BASE..$b") == 0 )) || continue
    vua_dung "$b" && continue
    wt="$(wt_of "$b")"
    [[ "$wt" == "$MAIN_WT" ]] && continue
    if [[ -n "$wt" ]]; then
      if git worktree remove "$wt" 2>/tmp/ra_nhanh.$$; then echo "xoá worktree  $wt"
      else echo "GIỮ worktree  $wt — $(head -1 /tmp/ra_nhanh.$$)"; continue; fi
    fi
    git branch -d -q "$b" && echo "xoá nhánh     $b"
  done
  rm -f /tmp/ra_nhanh.$$
  git worktree prune
  exit 0
fi

echo "== Nhánh còn việc chưa vào $BASE ($chomerge) — cột: nhãn, nhánh, commit chưa merge, ngày từ commit cuối, file sửa chưa commit, lý do / commit cuối"
printf '%s' "${cho:-  (không có)
}"
echo
echo "== Đã merge, chờ dọn: $don_wt worktree, $don_br nhánh không worktree  →  bash ra_nhanh.sh --don"
[[ -n "$don_ban" ]] && { echo "== Đã merge nhưng worktree còn sửa chưa commit (--don giữ lại, cần xem tay):"; printf '%s' "$don_ban"; }
(( boquen > 0 )) && echo && echo "«BỎ QUÊN?»: merge, ghi lý do (--ghi), hoặc ghi «Loại bỏ» rồi xoá nhánh."
exit 0
