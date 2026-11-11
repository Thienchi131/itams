// Hàm thuần cho Yubico OTP — KHÔNG dùng node:crypto để import được ở client
// (popup nhận mã). Phần ký/kiểm tra YubiCloud ở yubicloud-protocol.ts.
//
// Chạm YubiKey (chế độ OTP) -> key "gõ" ra 44 ký tự modhex:
//   12 ký tự đầu  = Public ID cố định của key (nhận diện key nào)
//   32 ký tự sau  = phần mã hoá dùng 1 lần (YubiCloud giải mã + chống dùng lại)
// Modhex chỉ dùng 16 chữ: c b d e f g h i j k l n r t u v.

export const YUBIKEY_OTP_LENGTH = 44;
export const YUBIKEY_PUBLIC_ID_LENGTH = 12;
const MODHEX = "cbdefghijklnrtuv";

export function isModhexChar(ch: string): boolean {
  return ch.length === 1 && MODHEX.includes(ch);
}

export function isValidYubikeyOtp(otp: string): boolean {
  return otp.length === YUBIKEY_OTP_LENGTH && [...otp].every(isModhexChar);
}

export function extractPublicId(otp: string): string {
  return otp.slice(0, YUBIKEY_PUBLIC_ID_LENGTH);
}

// Key gõ theo VỊ TRÍ phím (như bàn phím US). Đọc KeyboardEvent.code (phím vật
// lý, VD "KeyC") thay vì ký tự, để bộ gõ tiếng Việt (Telex: f, r, j là dấu)
// hay bàn phím khác US không làm sai mã.
export function modhexFromKeyCode(code: string): string | null {
  const m = /^Key([A-Z])$/.exec(code);
  if (!m) return null;
  const ch = m[1].toLowerCase();
  return isModhexChar(ch) ? ch : null;
}

// Chuẩn hoá chuỗi dán/gõ tay: bỏ khoảng trắng, chữ thường, chỉ giữ modhex.
export function normalizeOtpInput(raw: string): string {
  return raw
    .toLowerCase()
    .split("")
    .filter(isModhexChar)
    .join("");
}
