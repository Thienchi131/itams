// Tiện ích bảo hành — dùng chung cho phiếu nhập kho, sửa thiết bị, trang chi
// tiết. Không có phụ thuộc server nên import được ở cả client component.

// Các mốc thời hạn bảo hành chuẩn (tháng). Ngày kết thúc = ngày bắt đầu +
// số tháng chọn, không cho gõ tay để tránh nhập sai.
export const WARRANTY_TERMS = [6, 12, 18, 24, 36, 60] as const;

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Số ngày còn lại tới hạn bảo hành (âm = đã hết). null nếu không có ngày KT.
export function warrantyDaysLeft(endDate: Date | null | undefined): number | null {
  if (!endDate) return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // Tính theo mốc 00:00 để "còn X ngày" không bị lệch do giờ trong ngày.
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
}

// Suy ra thời hạn (tháng) từ ngày bắt đầu + kết thúc, nếu khớp đúng 1 mốc
// chuẩn (để form Sửa chọn sẵn đúng mốc). "" nếu không khớp mốc nào.
export function inferWarrantyTerm(startDate: Date | null, endDate: Date | null): string {
  if (!startDate || !endDate) return "";
  const target = endDate.toISOString().slice(0, 10);
  for (const t of WARRANTY_TERMS) {
    if (addMonths(startDate, t).toISOString().slice(0, 10) === target) return String(t);
  }
  return "";
}
