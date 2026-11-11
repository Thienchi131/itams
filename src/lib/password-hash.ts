// Băm + mã hoá mật khẩu.
//
// 1. Băm một chiều bằng bcrypt cost 12 (không giải ngược được).
// 2. Mã hoá THÊM chuỗi băm bằng AES-256-GCM với khoá PASSWORD_ENCRYPTION_KEY
//    (chỉ nằm trong .env, KHÔNG nằm trong database). Lộ database mà không có
//    khoá thì chuỗi băm vô dụng, không dò mật khẩu được.
//
// Dạng lưu trong cột User.password:
//   enc:v1:<iv base64url>:<ciphertext+authTag base64url>   (đã mã hoá)
//   $2b$12$...                                             (bcrypt cũ, chưa mã hoá)
// Bản cũ vẫn đăng nhập được và tự chuyển sang dạng mã hoá ở lần đăng nhập
// đúng tiếp theo; muốn chuyển hết ngay thì chạy prisma/encrypt-password-hashes.ts.
//
// MẤT KHOÁ = KHÔNG AI ĐĂNG NHẬP ĐƯỢC (kể cả khôi phục từ backup) — cất khoá
// riêng ở nơi an toàn khác VPS. Khoá phải KHÁC BACKUP_ENCRYPTION_KEY.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
const PREFIX = "enc:v1:";
const AAD = Buffer.from("itams-password-hash-v1");

function getKey(): Buffer | null {
  const hex = process.env.PASSWORD_ENCRYPTION_KEY?.trim();
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("PASSWORD_ENCRYPTION_KEY phải đúng 64 ký tự hex (tạo bằng: openssl rand -hex 32).");
  }
  return Buffer.from(hex, "hex");
}

export function isEncryptedPasswordHash(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function encryptPasswordHash(bcryptHash: string): string {
  const key = getKey();
  if (!key) return bcryptHash;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(bcryptHash, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${PREFIX}${iv.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptPasswordHash(stored: string): string {
  const key = getKey();
  if (!key) {
    throw new Error(
      "Mật khẩu trong database đã được mã hoá nhưng thiếu PASSWORD_ENCRYPTION_KEY trong .env — không thể đăng nhập."
    );
  }
  const [ivPart, dataPart] = stored.slice(PREFIX.length).split(":");
  const iv = Buffer.from(ivPart ?? "", "base64url");
  const data = Buffer.from(dataPart ?? "", "base64url");
  if (iv.length !== 12 || data.length <= 16) throw new Error("Chuỗi mật khẩu mã hoá bị hỏng.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8");
}

// Băm (bcrypt cost 12) rồi mã hoá (nếu đã cấu hình khoá). Dùng cho MỌI chỗ
// đặt mật khẩu mới.
export async function hashPassword(plain: string): Promise<string> {
  return encryptPasswordHash(await bcrypt.hash(plain, BCRYPT_COST));
}

// So mật khẩu nhập vào với giá trị đang lưu (mã hoá hoặc bcrypt cũ).
// needsUpgrade = đúng mật khẩu nhưng đang lưu dạng cũ (chưa mã hoá trong khi
// đã có khoá, hoặc bcrypt cost < 12) -> nên lưu lại bằng hashPassword().
export async function verifyPassword(
  plain: string,
  stored: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  const encrypted = isEncryptedPasswordHash(stored);
  let bcryptHash: string;
  try {
    bcryptHash = encrypted ? decryptPasswordHash(stored) : stored;
  } catch (err) {
    // Sai khoá / dữ liệu hỏng: không cho đăng nhập, ghi log để Admin biết.
    console.error("verifyPassword: không giải mã được mật khẩu đã lưu", err);
    return { valid: false, needsUpgrade: false };
  }

  const valid = await bcrypt.compare(plain, bcryptHash);
  if (!valid) return { valid: false, needsUpgrade: false };

  let rounds = BCRYPT_COST;
  try {
    rounds = bcrypt.getRounds(bcryptHash);
  } catch {
    // giữ nguyên
  }
  const needsUpgrade = rounds < BCRYPT_COST || (!encrypted && getKey() !== null);
  return { valid: true, needsUpgrade };
}
