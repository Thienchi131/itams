// Chính sách mật khẩu dùng chung cho mọi nơi đặt/đổi mật khẩu (user tự đổi,
// Admin reset mật khẩu user khác, tạo tài khoản mới). Trả về thông báo lỗi
// tiếng Việt nếu không đạt, hoặc null nếu hợp lệ.
export const PASSWORD_MIN_LENGTH = 12;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
  }
  if (!/[a-z]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 chữ thường";
  }
  if (!/[A-Z]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 chữ in hoa";
  }
  if (!/[0-9]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 chữ số";
  }
  return null;
}
