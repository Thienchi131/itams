import crypto from "crypto";

function getSecret(): string {
  const secret = process.env.WT_SECRET;

  if (!secret) {
    throw new Error(
      "WT_SECRET is not set. Add a long random value to your .env file."
    );
  }

  return secret;
}

// Phiên đăng nhập chỉ có hiệu lực tối đa 2 giờ kể từ lúc đăng nhập — tính cố
// định từ thời điểm đăng nhập (không phải idle timeout), áp dụng cho MỌI
// user kể cả khi tick "Ghi nhớ đăng nhập" (remember-me lúc này chỉ còn tác
// dụng giữ cookie qua việc đóng/mở lại trình duyệt trong vòng 2 giờ đó, chứ
// không kéo dài hiệu lực phiên đăng nhập quá 2 giờ).
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type SessionData = {
  userId: number;
  twoFactorVerified: boolean;
};

/**
 * Signs "<userId>.<issuedAtMs>.<tfa>" into a "<id>.<issuedAt>.<tfa>.<hmac>"
 * token so the session cookie can't be forged, and so verifySession() can
 * enforce the 2h absolute expiry below.
 *
 * `twoFactorVerified` is per-SESSION, not per-account — mỗi lần đăng nhập
 * lại bằng password đều bắt đầu ở false, kể cả khi tài khoản đã bật 2FA từ
 * trước; chỉ chuyển thành true sau khi nhập đúng mã TOTP ở /verify-2fa (hoặc
 * vừa hoàn tất thiết lập lần đầu ở /setup-2fa). requireLogin() dựa vào cờ
 * này để chặn truy cập các trang khác cho tới khi bước 2FA hoàn tất.
 */
export function signSession(userId: number, twoFactorVerified: boolean): string {
  const issuedAt = Date.now();
  const tfa = twoFactorVerified ? "1" : "0";
  const payload = `${userId}.${issuedAt}.${tfa}`;

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

/**
 * Verifies a session token produced by signSession and returns the payload,
 * or null if the token is missing, malformed, tampered with, or older than
 * SESSION_MAX_AGE_MS (2 giờ) — trong trường hợp hết hạn, caller (auth.service)
 * coi như chưa đăng nhập và sẽ đá về /login.
 */
export function verifySession(
  token: string | undefined | null
): SessionData | null {
  if (!token) return null;

  const [idPart, issuedAtPart, tfaPart, signature] = token.split(".");

  if (!idPart || !issuedAtPart || !tfaPart || !signature) return null;

  const payload = `${idPart}.${issuedAtPart}.${tfaPart}`;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  const issuedAt = Number(issuedAtPart);

  if (!Number.isFinite(issuedAt)) return null;

  if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) {
    return null;
  }

  const userId = Number(idPart);

  if (!Number.isFinite(userId)) return null;

  return { userId, twoFactorVerified: tfaPart === "1" };
}
