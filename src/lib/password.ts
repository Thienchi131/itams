import crypto from "crypto";

// Bộ ký tự loại bỏ các ký tự dễ nhầm (O/0, I/l/1) để đọc/gõ lại dễ hơn.
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SPECIAL = "!@#$%";
const ALL = LOWER + UPPER + DIGITS + SPECIAL;

function pick(set: string): string {
  return set[crypto.randomInt(0, set.length)];
}

// Sinh mật khẩu ngẫu nhiên LUÔN đủ chữ thường + chữ in hoa + chữ số để vượt
// qua validatePassword() (xem password-policy.ts) — dùng cho mật khẩu tạm khi
// tạo tài khoản. Độ dài tối thiểu 12.
export function generateRandomPassword(length = 12) {
  const len = Math.max(length, 12);
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  const rest = Array.from({ length: len - required.length }, () => pick(ALL));
  const chars = [...required, ...rest];
  // Fisher-Yates shuffle để vị trí 3 ký tự bắt buộc không cố định ở đầu.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
