-- Danh sách kho BỔ SUNG ngoài User.regionId/warehouseId — cho phép 1 user
-- (VD kế toán) xem được 1 tổ hợp kho tuỳ ý CẮT NGANG nhiều Region khác nhau,
-- mà không phải gộp các Region đó lại (sẽ ảnh hưởng phân quyền của Lead
-- đang phụ trách riêng từng Region). Xem ghi chú đầy đủ ở schema.prisma và
-- getCurrentUser() trong auth.service.ts.

-- CreateTable
CREATE TABLE "UserWarehouseAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWarehouseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWarehouseAccess_userId_warehouseId_key" ON "UserWarehouseAccess"("userId", "warehouseId");

-- CreateIndex
CREATE INDEX "UserWarehouseAccess_userId_idx" ON "UserWarehouseAccess"("userId");

-- CreateIndex
CREATE INDEX "UserWarehouseAccess_warehouseId_idx" ON "UserWarehouseAccess"("warehouseId");

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess"
  ADD CONSTRAINT "UserWarehouseAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess"
  ADD CONSTRAINT "UserWarehouseAccess_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
