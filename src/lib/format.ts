export const SERIAL_MAX_LENGTH = 16;

/**
 * Serial number đôi khi bị người dùng nhập nhầm thành chuỗi rất dài (dán
 * nhầm nội dung khác), gây vỡ layout ở bảng danh sách và trang chi tiết.
 * Cắt bớt khi hiển thị — data gốc trong DB không đổi, chỗ nào cần xem đầy
 * đủ thì show title/tooltip.
 *
 * Luôn viết hoa khi hiển thị — data cũ trong DB có thể đã lưu chữ thường
 * (nhập tay trước khi các form nhập liệu tự động uppercase), hiển thị lẫn
 * lộn hoa/thường trông không đồng nhất. Chuẩn hoá ở đây (chỉ khi hiển thị,
 * không đổi DB) để mọi nơi trong app luôn thấy serial dạng viết hoa.
 */
export function truncateSerial(serial: string | null | undefined) {
  if (!serial) return serial ?? null;
  const upper = serial.toUpperCase();
  return upper.length > SERIAL_MAX_LENGTH
    ? `${upper.slice(0, SERIAL_MAX_LENGTH)}...`
    : upper;
}
