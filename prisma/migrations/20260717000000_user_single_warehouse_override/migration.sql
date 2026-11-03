-- Thêm lại User.warehouseId (đã bị xoá ở migration region_scoped_access) —
-- lần này KHÔNG thay thế regionId mà tồn tại SONG SONG, dùng cho nhân viên
-- chỉ phụ trách đúng 1 kho lẻ (VD kho DXB 2), phân biệt với Lead phụ trách
-- nguyên khu vực (dùng regionId, thấy hết mọi kho trong Region). Nếu 1 user
-- lỡ có cả regionId lẫn warehouseId, ứng dụng ưu tiên warehouseId (phạm vi
-- hẹp hơn) — xem getCurrentUser() trong auth.service.ts.
ALTER TABLE "User" ADD COLUMN "warehouseId" INTEGER;

ALTER TABLE "User"
  ADD CONSTRAINT "User_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_warehouseId_idx" ON "User"("warehouseId");
