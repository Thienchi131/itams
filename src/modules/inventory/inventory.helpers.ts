// Hằng số + hàm thuần cho Kiểm kê kho — dùng được ở cả client component lẫn
// server (không import node:fs/Prisma runtime).

export type InventoryScope = "IN_STOCK" | "PENDING_LIQUIDATION";

export const INVENTORY_SCOPE_LABEL: Record<InventoryScope, string> = {
  IN_STOCK: "Tài sản trong kho",
  PENDING_LIQUIDATION: "Tài sản chờ thanh lý",
};

export type InventoryStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  IN_PROGRESS: "Đang kiểm kê",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã huỷ",
};

export function parseInventoryScope(value: FormDataEntryValue | null): InventoryScope | null {
  return value === "IN_STOCK" || value === "PENDING_LIQUIDATION" ? value : null;
}

/** Tên field FormData chứa ảnh chụp xác nhận. */
export const INVENTORY_PHOTO_FIELD = "photo";

/** Ảnh chụp từ camera đã thu nhỏ ở trình duyệt (~200–500 KB) — trần 3 MB. */
export const INVENTORY_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/** Cạnh dài tối đa (px) của ảnh chụp sau khi thu nhỏ ở trình duyệt. */
export const INVENTORY_PHOTO_MAX_DIMENSION = 1600;

/** Chất lượng JPEG ảnh chụp kiểm kê. */
export const INVENTORY_PHOTO_JPEG_QUALITY = 0.8;
