-- Lưu thời điểm user cuối cùng mở panel thông báo, dùng để tính số thông báo
-- CHƯA đọc (thay vì luôn hiển thị số lượng cố định như trước).
ALTER TABLE "User" ADD COLUMN "lastNotificationReadAt" TIMESTAMP(3);
