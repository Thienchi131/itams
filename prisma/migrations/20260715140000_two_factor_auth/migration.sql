-- Bắt buộc 2FA (Google Authenticator, TOTP) cho MỌI tài khoản. twoFactorSecret
-- chỉ được set khi user bắt đầu quá trình thiết lập ở trang /setup-2fa —
-- twoFactorEnabled chỉ bật lên true SAU KHI xác nhận đúng mã đầu tiên (xem
-- src/app/setup-2fa/actions.ts), tránh trường hợp mã bị nhập sai/scan hỏng
-- mà tài khoản đã coi như "đã bật 2FA".
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
