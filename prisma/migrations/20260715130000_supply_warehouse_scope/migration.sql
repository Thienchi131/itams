-- Thêm phân quyền theo kho cho Vật tư — Admin chọn được kho bất kỳ, IT bị
-- gán 1 kho thì Vật tư tạo/xem/nhập/xuất đều khoá theo đúng kho đó (xem
-- assertWarehouseScope trong auth.service.ts). Migration này tách riêng
-- (không gộp vào 20260715120000_supply_inventory) vì migration đó đã được
-- deploy lên production trước khi tính năng phân kho này được thêm vào —
-- sửa lại nội dung migration cũ sau khi đã apply sẽ làm lệch checksum.
ALTER TABLE "Supply" ADD COLUMN "warehouseId" INTEGER;

ALTER TABLE "Supply"
  ADD CONSTRAINT "Supply_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Supply_warehouseId_idx" ON "Supply"("warehouseId");
