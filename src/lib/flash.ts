// Thông báo "flash" dùng chung cho toàn app — server action redirect kèm
// ?flash=<mã>, component FlashToast (đặt ở layout gốc) đọc mã, hiện toast rồi
// tự xoá tham số khỏi URL. Mã bắt đầu bằng "err_" hiển thị dạng lỗi.
// Thêm thông báo mới: thêm 1 dòng vào FLASH_MESSAGES rồi dùng withFlash().

export const FLASH_MESSAGES: Record<string, string> = {
  // Thiết bị
  asset_assigned: "Đã bàn giao thiết bị.",
  asset_sent_repair: "Đã chuyển thiết bị sang Bảo trì.",
  asset_retired: "Đã chuyển thiết bị vào Kho thanh lý (chờ thanh lý).",
  asset_transfer_requested: "Đã gửi yêu cầu luân chuyển kho, chờ kho đích xác nhận.",
  asset_transfer_confirmed: "Đã xác nhận nhập kho.",
  asset_returned: "Đã thu hồi thiết bị về kho.",
  asset_repair_completed: "Đã hoàn tất sửa chữa, thiết bị trở về Trong kho.",
  asset_repair_followup: "Đã cập nhật tiến độ sửa chữa.",
  asset_updated: "Đã lưu thông tin thiết bị.",
  stock_in_created: "Đã lưu phiếu nhập kho.",
  liquidation_confirmed: "Đã xác nhận thanh lý.",
  // Nhân viên
  employee_created: "Đã tạo nhân viên.",
  employee_updated: "Đã lưu thông tin nhân viên.",
  employees_merged: "Đã gộp nhân viên.",
  employee_bulk_returned: "Đã thu hồi các thiết bị đã chọn.",
  employee_bulk_transferred: "Đã gửi yêu cầu luân chuyển các thiết bị đã chọn.",
  employee_asset_assigned: "Đã cấp thêm thiết bị cho nhân viên.",
  // Model
  model_created: "Đã tạo model.",
  model_updated: "Đã lưu model.",
  model_tag_updated: "Đã cập nhật tag model.",
  // Vật tư
  supply_created: "Đã tạo vật tư.",
  supply_updated: "Đã lưu vật tư.",
  supply_stocked_in: "Đã nhập kho vật tư.",
  supply_stocked_out: "Đã xuất kho vật tư.",
  // Tài khoản
  user_created: "Đã tạo tài khoản và gửi email mật khẩu.",
  user_updated: "Đã lưu tài khoản.",
  user_password_changed: "Đã đổi mật khẩu cho tài khoản (bắt đổi lại ở lần đăng nhập tới).",
  own_password_changed: "Đã đổi mật khẩu của bạn.",
  // Lỗi
  err_user_duplicate_email: "Email này đã thuộc về tài khoản khác.",
  err_user_missing_fields: "Vui lòng nhập đủ Họ tên, Email và Quyền.",
  err_user_invalid_email: "Email không hợp lệ.",
  err_user_last_admin: "Không thể hạ quyền Admin cuối cùng của hệ thống.",
};

/** Gắn ?flash=<code> vào URL (giữ nguyên các tham số khác). */
export function withFlash(url: string, code: keyof typeof FLASH_MESSAGES | string) {
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("flash", code);
  return `${path}?${params.toString()}`;
}

/** Hiện toast ngay từ client (cho action không redirect). */
export function showToast(message: string, tone: "success" | "error" = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("itams:toast", { detail: { message, tone } }));
}
