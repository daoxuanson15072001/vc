# Dùng chung cho start_web.sh / start_uat.sh / start_qa.sh (source, không chạy trực tiếp).
# Dò file cấu hình MongoDB của Homebrew: MONGOD_CONF (nếu đặt) → /usr/local (Intel / Rosetta) → /opt/homebrew (Apple Silicon).
# /usr/local đứng trước có chủ ý: máy chủ hiện tại có CẢ HAI file, trỏ HAI dbPath khác nhau
# (/usr/local/var/mongodb là dữ liệu thật đang chạy, /opt/homebrew/var/mongodb là bản khác) — đổi thứ tự
# sẽ bật MongoDB trên nhầm dữ liệu. Máy Apple Silicon mới chỉ có /opt/homebrew thì tự dùng file đó.

find_mongod_conf() {
  local c
  for c in "$MONGOD_CONF" /usr/local/etc/mongod.conf /opt/homebrew/etc/mongod.conf; do
    [[ -n "$c" && -f "$c" ]] && { echo "$c"; return 0; }
  done
  return 1
}

# MongoDB chưa trả lời ping thì bật bằng file cấu hình dò được; không tìm thấy file thì báo rõ và trả lỗi.
ensure_mongo() {
  mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && return 0
  local conf
  if ! conf=$(find_mongod_conf); then
    echo "MongoDB chưa chạy và không tìm thấy mongod.conf (đã dò MONGOD_CONF, /usr/local/etc, /opt/homebrew/etc)."
    echo "Bật tay: brew services start mongodb-community   hoặc đặt MONGOD_CONF=<đường dẫn> rồi chạy lại."
    return 1
  fi
  echo "MongoDB chưa chạy — khởi động (cấu hình $conf)..."
  mongod --config "$conf" --fork >/dev/null
}
