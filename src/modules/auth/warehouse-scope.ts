// Tính phạm vi kho (regionWarehouseIds) của 1 tài khoản BẤT KỲ — cùng đúng
// quy tắc với getCurrentUser() trong auth.service.ts (null = không giới
// hạn). Dùng khi cần biết phạm vi của NGƯỜI KHÁC (không phải người đang đăng
// nhập), VD lọc danh sách IT được phép tham gia kiểm kê 1 kho.
// LƯU Ý: đổi quy tắc ở getCurrentUser() thì phải đổi cả ở đây (có unit test
// warehouse-scope.test.ts mô tả các trường hợp).
export function computeWarehouseScope({
  warehouseId,
  regionWarehouseIds,
  customWarehouseIds,
  sharedWarehouseIds,
}: {
  /** User.warehouseId — phạm vi hẹp nhất, được ưu tiên. */
  warehouseId: number | null;
  /** Kho thuộc User.region; null nếu user không gán Region. */
  regionWarehouseIds: number[] | null;
  /** Kho bổ sung (UserWarehouseAccess). */
  customWarehouseIds: number[];
  /** Kho đánh dấu dùng chung (Warehouse.isShared). */
  sharedWarehouseIds: number[];
}): number[] | null {
  const base = warehouseId
    ? [warehouseId]
    : regionWarehouseIds
      ? regionWarehouseIds
      : customWarehouseIds.length > 0
        ? customWarehouseIds
        : null;

  if (base === null) return null;

  return [...new Set([...base, ...customWarehouseIds, ...sharedWarehouseIds])];
}

export function scopeIncludesWarehouse(scope: number[] | null, warehouseId: number | null) {
  return scope === null || (warehouseId !== null && scope.includes(warehouseId));
}
