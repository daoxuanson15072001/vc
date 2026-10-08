---
name: khoi-dong-phien
description: Dùng khi mở phiên mới (phiên M1, phiên gác cổng, phiên tài liệu) để kiểm tra môi trường một lần và báo bảng ✅/❌ trước khi làm việc.
---

# Khởi động phiên

Chạy kiểm tra trong **một lệnh Bash gộp**, rồi báo bảng ✅/❌ tối đa 10 dòng.

```bash
cd "$(git rev-parse --show-toplevel)"
echo "== nhánh"; git status -sb | head -5
echo "== so với main"; git rev-list --left-right --count main...HEAD
echo "== worktree"; git worktree list
echo "== glab"; glab auth status 2>&1 | head -3
echo "== ssh gitlab"; ssh -o BatchMode=yes -o ConnectTimeout=5 -T git@gitlab.com 2>&1 | head -2
echo "== khóa driver"; cat ~/.vclinks-driver.lock 2>&1
echo "== deps"; ls node_modules >/dev/null 2>&1 && ls packages/shared/dist/index.cjs 2>&1 | head -1
```

## Kiểm tra

| Mục | Đạt khi |
|---|---|
| Git | Cây làm việc sạch (hoặc chỉ có thay đổi của phiên này), đúng nhánh phiên |
| Worktree | Tạo từ `main` mới nhất: số commit `main` có mà nhánh thiếu = 0 |
| GitLab | `glab auth status` và `ssh -T` đều qua (bỏ qua nếu chưa nối GitLab) |
| Khóa driver | Chỉ kiểm khi phiên dùng Chrome driver: không có file, hoặc file là của chính phiên này |
| Deps | Worktree mới chưa có `node_modules` hoặc `packages/shared/dist`: chạy `pnpm install --frozen-lockfile --prefer-offline && pnpm --filter @vclinks/shared build` (dist không nằm trong git) |
| Dòng phiên | Đọc đúng dòng của phiên trong `docs/01-quan-ly-du-an/m1/so-phien.md` (`grep -n "<mã phiên>"`): mã, model đầu, phải xong trước. Phiên phụ thuộc chưa xong thì ❌ |
| Hạn mức | Nếu là phiên đầu nhịp, nhắc chủ dự án gõ `/usage` (Codex không tự xem được) |

## Báo cáo

- Bảng ✅/❌ ngắn, mỗi mục một dòng.
- Mục ❌: nói cách sửa trong **một câu**, rồi gom câu hỏi theo AGENTS.md §15.2 (đánh số Q1, Q2…, có đề xuất mặc định).
- Không đọc lại tài liệu kế hoạch dài; chỉ đọc dòng của phiên.
