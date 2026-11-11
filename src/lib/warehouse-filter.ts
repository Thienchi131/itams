// Có nên hiện dropdown lọc kho hay không: chỉ hiện khi người dùng thực sự
// được chọn từ 2 kho TRỞ LÊN trong phạm vi (gộp mọi khu vực + kho chưa gán
// khu vực).
//
// Trước đây mỗi trang tự xét `allRegions.some(r => r.warehouses.length > 1)`
// — SAI với IT quản lý nhiều kho nằm Ở CÁC KHU VỰC KHÁC NHAU (mỗi khu vực chỉ
// 1 kho trong phạm vi): không khu vực nào có >1 kho nên dropdown bị ẩn hẳn,
// IT không chọn được kho nào. Đếm TỔNG số kho mới đúng.
export function scopedWarehouseCount(
  regions: { warehouses: unknown[] }[],
  unassignedWarehouses: unknown[]
): number {
  return (
    regions.reduce((sum, region) => sum + region.warehouses.length, 0) +
    unassignedWarehouses.length
  );
}
