#!/usr/bin/env bash
# Chạy trên MÁY MAC BACKUP (không phải VPS) — kéo toàn bộ file backup đã mã
# hoá (AES-256-GCM, xem Cài đặt > Backup & Restore) từ VPS về máy này, để
# không chỉ có 1 bản duy nhất sống trên VPS — nếu VPS gặp sự cố (hỏng ổ đĩa,
# bị xoá nhầm, bị tấn công...), vẫn còn 1 bản sao độc lập ở đây.
#
# Cố tình KHÔNG dùng cờ --delete: máy Mac này sẽ giữ lại backup lâu hơn 14
# ngày mà VPS tự xoá (xem scripts/backup-db.sh), coi như 1 kho lưu trữ dài
# hạn hơn, không bị đồng bộ xoá theo VPS.
#
# Sau MỖI lần chạy (dù thành công hay lỗi), tự POST báo cáo lên webapp ITAMS
# (Cài đặt > Backup & Restore > "Máy backup ngoài") để Admin xem được máy
# này có đang chạy đều đặn hằng ngày không, không cần tự SSH vào máy Mac
# kiểm tra tay — nếu quá 26 giờ không có báo cáo THÀNH CÔNG nào, trang đó tự
# hiện cảnh báo. Chỉ gửi trạng thái tóm tắt lên webapp, KHÔNG gửi log chi
# tiết — log đầy đủ vẫn nằm ở pull.log ngay trên máy Mac.
#
# CÀI 1 LẦN trước khi dùng — xem hướng dẫn đầy đủ Claude đã gửi kèm file
# này (tạo SSH key riêng cho máy Mac, thêm public key vào VPS, hẹn giờ chạy
# tự động bằng launchd, điền REPORT_TOKEN bên dưới).

set -uo pipefail

VPS_HOST="it-hd@175.100.28.81"
VPS_PORT="22000"
SSH_KEY="$HOME/.ssh/itams_backup_pull"
REMOTE_DIR="~/itams/backups/"
LOCAL_DIR="$HOME/itams-backups"
LOG_FILE="$LOCAL_DIR/pull.log"

# --- Báo cáo lên webapp — ĐIỀN REPORT_TOKEN trước khi dùng (lấy từ
# BACKUP_PULL_REPORT_TOKEN trong .env trên VPS) ---
REPORT_URL="https://itam.applesmng.com/api/backup-pull/report"
REPORT_TOKEN="DIEN_BACKUP_PULL_REPORT_TOKEN_VAO_DAY"
SOURCE_NAME="Mac backup ($(hostname -s 2>/dev/null || hostname))"

mkdir -p "$LOCAL_DIR"

echo "[$(date)] Bắt đầu kéo backup từ VPS..." >>"$LOG_FILE"

RSYNC_OUTPUT=$(rsync -avz \
  -e "ssh -p $VPS_PORT -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=15" \
  "$VPS_HOST:$REMOTE_DIR" "$LOCAL_DIR/" 2>&1)
RSYNC_EXIT=$?

echo "$RSYNC_OUTPUT" >>"$LOG_FILE"

TOTAL=$(find "$LOCAL_DIR" -maxdepth 1 -name "itams_db_*.sql.gz*" | wc -l | tr -d ' ')

if [ "$RSYNC_EXIT" -eq 0 ]; then
  echo "[$(date)] Xong. Tổng số file hiện có trên máy Mac: $TOTAL" >>"$LOG_FILE"
  STATUS="success"
  MESSAGE="OK"
else
  echo "[$(date)] LỖI rsync (mã $RSYNC_EXIT) — xem chi tiết ở trên." >>"$LOG_FILE"
  STATUS="error"
  MESSAGE="rsync thoat ma $RSYNC_EXIT - xem pull.log tren may Mac"
fi

curl -fsS -m 15 -X POST "$REPORT_URL" \
  -H "Authorization: Bearer $REPORT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"$SOURCE_NAME\",\"status\":\"$STATUS\",\"fileCount\":$TOTAL,\"message\":\"$MESSAGE\"}" \
  >>"$LOG_FILE" 2>&1
CURL_EXIT=$?

if [ "$CURL_EXIT" -ne 0 ]; then
  echo "[$(date)] Cảnh báo: không gửi được báo cáo lên webapp (curl mã $CURL_EXIT)." >>"$LOG_FILE"
fi
