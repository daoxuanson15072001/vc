# Sao lưu PostgreSQL của VC ID (thiết kế SSO mục 7): pg_dump mỗi đêm, giữ 14 bản ngày + 6 bản tháng,
# đẩy một bản ra ngoài máy bằng rclone (tuỳ chọn). Cùng bản PostgreSQL với database.
FROM postgres:17-alpine
# rclone là tệp chạy tĩnh, lấy từ ảnh chính thức (không cần mạng tới kho gói Alpine lúc build).
COPY --from=rclone/rclone:1.71.1 /usr/local/bin/rclone /usr/local/bin/rclone
ENV TZ=Asia/Ho_Chi_Minh \
    BACKUP_DIR=/backups
COPY --chmod=0755 backup.sh restore.sh lich.sh /usr/local/bin/
ENTRYPOINT ["lich.sh"]
