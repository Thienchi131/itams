// Hằng số + hàm thuần (không đụng fs/DB) cho tính năng ảnh xác nhận bàn
// giao — tách riêng khỏi handover-photo.service.ts để dùng được cả ở client
// component (HandoverPhotoPicker) lẫn unit test mà không kéo theo node:fs.

/** Số ngày được phép bổ sung ảnh kể từ lúc bàn giao. */
export const HANDOVER_PHOTO_DUE_DAYS = 7;

/** Tối đa bao nhiêu ảnh cho 1 lượt bàn giao (tính cả ảnh bổ sung sau). */
export const HANDOVER_PHOTO_MAX_COUNT = 5;

/**
 * Giới hạn dung lượng 1 ảnh phía server. Ảnh đã nén ở trình duyệt thường chỉ
 * 200–500 KB — 3 MB là mức trần an toàn, chặn request gọi thẳng với file gốc
 * chưa nén. 5 ảnh x 3 MB = 15 MB, vẫn dưới client_max_body_size 25m của Nginx.
 */
export const HANDOVER_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/** Cạnh dài tối đa (px) sau khi nén ở trình duyệt. */
export const HANDOVER_PHOTO_MAX_DIMENSION = 1600;

/** Chất lượng JPEG khi nén ở trình duyệt (0–1). */
export const HANDOVER_PHOTO_JPEG_QUALITY = 0.75;

/** Tên field trong FormData chứa các file ảnh. */
export const HANDOVER_PHOTO_FIELD = "handoverPhotos";

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeHandoverPhotoDueAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + HANDOVER_PHOTO_DUE_DAYS * DAY_MS);
}

/** JPEG luôn bắt đầu bằng marker SOI (FF D8) theo sau là 1 marker FF. */
export function isJpegBuffer(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export type HandoverPhotoStatus =
  // Không áp dụng hạn (lượt bàn giao cũ trước khi có tính năng).
  | { kind: "none" }
  // Đã có ít nhất 1 ảnh.
  | { kind: "done" }
  // Chưa có ảnh, còn trong hạn — daysRemaining >= 1 (làm tròn lên: còn
  // 2 giờ vẫn tính là "còn 1 ngày"; vừa bàn giao xong là "còn 7 ngày").
  | { kind: "pending"; daysRemaining: number }
  // Chưa có ảnh và đã quá hạn — daysOverdue >= 1.
  | { kind: "overdue"; daysOverdue: number };

export function getHandoverPhotoStatus(
  photoDueAt: Date | null,
  photoCount: number,
  now: Date = new Date()
): HandoverPhotoStatus {
  if (photoCount > 0) return { kind: "done" };
  if (!photoDueAt) return { kind: "none" };

  const diffMs = photoDueAt.getTime() - now.getTime();

  if (diffMs >= 0) {
    return { kind: "pending", daysRemaining: Math.max(1, Math.ceil(diffMs / DAY_MS)) };
  }

  return { kind: "overdue", daysOverdue: Math.max(1, Math.ceil(-diffMs / DAY_MS)) };
}

/**
 * Tên file lưu trên đĩa: "YYYY/MM/<uuid>.jpg". Validate lại MỖI lần đọc/xoá
 * (dù giá trị lấy từ DB) — chặn path traversal nếu dữ liệu DB bị sửa tay.
 */
export const HANDOVER_PHOTO_FILENAME_RE =
  /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
