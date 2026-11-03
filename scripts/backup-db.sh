#!/usr/bin/env bash
# Backup PostgreSQL của ITAMS — chạy trên VPS, ngay trong thư mục ~/itams
# (nơi có docker-compose.yml). Gọi vào ĐÚNG code tạo backup của app
# (prisma/create-encrypted-backup.ts -> backup.service.ts), để file backup
# tạo tự động qua cron cũng được mã hoá AES-256-GCM giống hệt file tạo bằng
# tay trong Cài đặt > Backup & Restore (cùng 1 khoá BACKUP_ENCRYPTION_KEY),
# thay vì tự pg_dump/gzip riêng ở đây — chỉ 1 nơi duy nhất cài logic mã hoá,
# tránh lệch định dạng giữa 2 đường tạo backup.
#
# YÊU CẦU: container "app" phải đang chạy (docker compose up -d) và biến
# BACKUP_ENCRYPTION_KEY đã có trong .env — script sẽ báo lỗi rõ ràng nếu
# thiếu, không tạo ra file backup không mã hoá "lỡ tay".
#
# Cách chạy tay 1 lần:
#   bash scripts/backup-db.sh
#
# Cách chạy tự động mỗi ngày (crontab -e), 2h sáng hằng ngày:
#   0 2 * * * cd /home/it-hd/itams && bash scripts/backup-db.sh >> /home/it-hd/itams/backups/backup.log 2>&1

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="./backups"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Bắt đầu backup (mã hoá) qua container app..."

docker compose exec -T app npx tsx prisma/create-encrypted-backup.ts

echo "[$(date)] Backup xong."

# Xoá backup cũ hơn KEEP_DAYS ngày — cả 2 định dạng: ".sql.gz.enc" (mới, đã
# mã hoá) và ".sql.gz" (cũ, từ trước khi có bước mã hoá — vẫn còn trên máy
# nếu chưa dọn tay).
find "$BACKUP_DIR" -name "itams_db_*.sql.gz.enc" -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "itams_db_*.sql.gz" -mtime +"$KEEP_DAYS" -delete

echo "[$(date)] Đã dọn backup cũ hơn $KEEP_DAYS ngày"
