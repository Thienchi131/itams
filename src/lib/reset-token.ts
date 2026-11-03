import crypto from "crypto";

// Token "Quên mật khẩu" tự phục vụ. Sinh 1 chuỗi ngẫu nhiên 32 byte (256 bit
// — không thể đoán được), gửi bản THẬT qua email cho user, chỉ lưu bản HASH
// (SHA-256) vào DB — giống hệt nguyên tắc lưu password, tránh việc lộ DB là
// dùng lại được token sống.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 giờ

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
