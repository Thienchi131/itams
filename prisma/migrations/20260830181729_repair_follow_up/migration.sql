-- Bảng ghi nhận "hướng xử lý" IT điền cho thiết bị đang sửa chữa/bảo hành đã
-- quá hạn (banner nhắc bắt buộc trên mọi trang) — xem ghi chú đầy đủ ở
-- model RepairFollowUp trong schema.prisma.

-- CreateTable
CREATE TABLE "RepairFollowUp" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairFollowUp_assetId_idx" ON "RepairFollowUp"("assetId");

-- CreateIndex
CREATE INDEX "RepairFollowUp_createdAt_idx" ON "RepairFollowUp"("createdAt");

-- AddForeignKey
ALTER TABLE "RepairFollowUp"
  ADD CONSTRAINT "RepairFollowUp_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
