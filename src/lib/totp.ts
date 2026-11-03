import { authenticator } from "otplib";

// Cho phép lệch 1 bước 30s (trước/sau) khi so mã — bù trừ đồng hồ điện
// thoại/server không khớp tuyệt đối, vẫn đủ chặt để không mở rộng cửa sổ
// đoán mã quá nhiều.
authenticator.options = { window: 1 };

const ISSUER = "ITAMS";

export function generateTwoFactorSecret(): string {
  return authenticator.generateSecret();
}

// URI dạng otpauth://... để encode ra QR — Google Authenticator/Authy/1Password
// đều hiểu chuẩn này. accountLabel nên là email/username để user phân biệt
// được tài khoản nào trong app authenticator nếu có nhiều tài khoản ITAMS.
export function getOtpAuthUri(secret: string, accountLabel: string): string {
  return authenticator.keyuri(accountLabel, ISSUER, secret);
}

export function verifyTwoFactorCode(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
