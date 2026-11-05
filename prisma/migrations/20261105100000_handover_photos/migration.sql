-- Ảnh xác nhận bàn giao thiết bị + hạn bổ sung ảnh (7 ngày) cho mỗi lượt bàn giao.

-- AlterTable
ALTER TABLE "AssetHistory" ADD COLUMN "photoDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AssetHistoryPhoto" (
    "id" SERIAL NOT NULL,
    "historyId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetHistoryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetHistory_photoDueAt_idx" ON "AssetHistory"("photoDueAt");

-- CreateIndex
CREATE INDEX "AssetHistoryPhoto_historyId_idx" ON "AssetHistoryPhoto"("historyId");

-- CreateIndex
CREATE INDEX "AssetHistoryPhoto_fileName_idx" ON "AssetHistoryPhoto"("fileName");

-- AddForeignKey
ALTER TABLE "AssetHistoryPhoto" ADD CONSTRAINT "AssetHistoryPhoto_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "AssetHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
