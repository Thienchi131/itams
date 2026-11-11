// Chính sách 2FA: YubiKey (Yubico OTP qua YubiCloud) là cách CHÍNH và BẮT BUỘC với mọi tài
// khoản; app Authenticator chỉ là cách DỰ PHÒNG (khi quên/mất key).
//
// Công tắc khẩn cấp: đặt REQUIRE_SECURITY_KEY=false trong .env rồi khởi động
// lại app để tạm quay về như cũ (app Authenticator dùng độc lập được) — VD
// khi YubiCloud trục trặc hoặc chưa phát đủ key.
export function isSecurityKeyRequired(): boolean {
  return process.env.REQUIRE_SECURITY_KEY !== "false";
}
