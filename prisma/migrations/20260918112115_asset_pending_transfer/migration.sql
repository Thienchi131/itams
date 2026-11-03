-- Lượt luân chuyển kho đang chờ IT kho đích xác nhận — xem ghi chú đầy đủ ở
-- schema.prisma (model Asset).

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "pendingTransferToWarehouseId" INTEGER,
ADD COLUMN     "pendingTransferPreviousStatus" "AssetStatus",
ADD COLUMN     "pendingTransferAt" TIMESTAMP(3),
ADD COLUMN     "pendingTransferBy" TEXT,
ADD COLUMN     "pendingTransferNote" TEXT;

-- CreateIndex
CREATE INDEX "Asset_pendingTransferToWarehouseId_idx" ON "Asset"("pendingTransferToWarehouseId");

-- AddForeignKey
ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_pendingTransferToWarehouseId_fkey"
  FOREIGN KEY ("pendingTransferToWarehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
