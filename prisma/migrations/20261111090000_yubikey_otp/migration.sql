-- Chuyển 2FA bằng YubiKey từ WebAuthn/FIDO2 sang Yubico OTP (xác minh qua YubiCloud).

-- DropForeignKey
ALTER TABLE "WebAuthnCredential" DROP CONSTRAINT "WebAuthnCredential_userId_fkey";

-- DropTable
DROP TABLE "WebAuthnCredential";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "webauthnChallenge",
DROP COLUMN "webauthnChallengeExpiresAt";

-- Ai chỉ có key WebAuthn (không có app Authenticator) -> thiết lập 2FA lại từ đầu.
UPDATE "User" SET "twoFactorEnabled" = false WHERE "totpEnabled" = false;

-- CreateTable
CREATE TABLE "YubikeyOtpDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "YubikeyOtpDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YubikeyOtpDevice_publicId_key" ON "YubikeyOtpDevice"("publicId");

-- CreateIndex
CREATE INDEX "YubikeyOtpDevice_userId_idx" ON "YubikeyOtpDevice"("userId");

-- AddForeignKey
ALTER TABLE "YubikeyOtpDevice" ADD CONSTRAINT "YubikeyOtpDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
