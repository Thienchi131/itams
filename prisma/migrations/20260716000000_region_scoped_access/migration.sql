-- Thêm khái niệm "Region" (khu vực) — gom nhiều Warehouse lại để 1 tài
-- khoản có thể phụ trách nhiều kho cùng lúc (vd khu vực Dubai gồm Dubai 1,
-- Dubai 2, RAK 1, RAK 2, RAK 3), thay vì trước đây User.warehouseId chỉ trỏ
-- được đúng 1 kho.
--
-- QUAN TRỌNG: để không ai bị mất/được thêm quyền xem ngoài ý muốn khi
-- chuyển đổi, script này tự tạo 1 Region cùng tên cho MỖI Warehouse đang có
-- sẵn, gán Warehouse đó vào đúng Region của nó, rồi map lại
-- User.warehouseId cũ sang đúng Region tương ứng. Sau khi chuyển xong,
-- Admin có thể gộp nhiều Warehouse vào chung 1 Region qua trang Cài đặt >
-- Khu vực khi cần (vd tách kho Dubai thành nhiều kho con nhưng vẫn chung 1
-- Region).

-- CreateTable
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- Seed 1 Region cho mỗi Warehouse đang có sẵn (nếu DB đang trống — vd VPS
-- mới tinh — vòng lặp này không làm gì cả, Region sẽ được seed cùng lúc với
-- Warehouse ở docker-entrypoint.sh).
INSERT INTO "Region" ("name")
SELECT w."name" FROM "Warehouse" w
ON CONFLICT ("name") DO NOTHING;

-- AlterTable: Warehouse.regionId
ALTER TABLE "Warehouse" ADD COLUMN "regionId" INTEGER;

UPDATE "Warehouse" w
SET "regionId" = r."id"
FROM "Region" r
WHERE r."name" = w."name";

ALTER TABLE "Warehouse"
  ADD CONSTRAINT "Warehouse_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Warehouse_regionId_idx" ON "Warehouse"("regionId");

-- AlterTable: User.regionId (map từ warehouseId cũ trước khi xoá cột đó)
ALTER TABLE "User" ADD COLUMN "regionId" INTEGER;

UPDATE "User" u
SET "regionId" = w."regionId"
FROM "Warehouse" w
WHERE u."warehouseId" = w."id";

ALTER TABLE "User"
  ADD CONSTRAINT "User_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_regionId_idx" ON "User"("regionId");

-- DropForeignKey + DropColumn: User.warehouseId không còn dùng nữa
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_warehouseId_fkey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "warehouseId";
