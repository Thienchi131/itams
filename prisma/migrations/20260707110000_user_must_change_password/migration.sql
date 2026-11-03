-- Thêm cờ bắt buộc đổi mật khẩu trong lần đăng nhập đầu tiên.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- Các tài khoản đã tồn tại (đang dùng bình thường) thì không bị bắt đổi mật
-- khẩu đột ngột — chỉ tài khoản tạo mới hoặc bị Admin reset pass sau này mới
-- có cờ này = true.
UPDATE "User" SET "mustChangePassword" = false;
