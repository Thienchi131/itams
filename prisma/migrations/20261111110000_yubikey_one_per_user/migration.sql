-- Mỗi tài khoản chỉ được 1 YubiKey (đổi key = Admin xoá key cũ).

-- Nếu lỡ có nhiều key/1 user thì giữ key đăng ký sau cùng.
DELETE FROM "YubikeyOtpDevice" a
USING "YubikeyOtpDevice" b
WHERE a."userId" = b."userId" AND a."id" < b."id";

-- DropIndex
DROP INDEX "YubikeyOtpDevice_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "YubikeyOtpDevice_userId_key" ON "YubikeyOtpDevice"("userId");
