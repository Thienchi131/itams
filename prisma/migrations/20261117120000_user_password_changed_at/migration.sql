-- Mốc đặt/đổi mật khẩu lần cuối. Nhúng vào token phiên (xem session.ts): đổi
-- hoặc reset mật khẩu sẽ cập nhật mốc này -> mọi cookie phiên ký bằng mốc cũ
-- lập tức hết hiệu lực. Các dòng hiện có lấy thời điểm chạy migration làm mặc
-- định; sau deploy user đang mở phiên sẽ phải đăng nhập lại 1 lần (format
-- token cũng đổi) — đây là hành vi mong muốn.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
