-- Kiểm kê kho: đợt kiểm kê + danh sách thiết bị (snapshot) + ảnh xác nhận.

-- CreateEnum
CREATE TYPE "InventoryAuditScope" AS ENUM ('IN_STOCK', 'PENDING_LIQUIDATION');

-- CreateEnum
CREATE TYPE "InventoryAuditStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InventoryAudit" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER,
    "warehouseLabel" TEXT NOT NULL,
    "scope" "InventoryAuditScope" NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,

    CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditItem" (
    "id" SERIAL NOT NULL,
    "auditId" INTEGER NOT NULL,
    "assetId" INTEGER,
    "assetTag" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "modelLabel" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "photoFileName" TEXT,
    "photoSizeBytes" INTEGER,

    CONSTRAINT "InventoryAuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAudit_warehouseId_idx" ON "InventoryAudit"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryAudit_status_idx" ON "InventoryAudit"("status");

-- CreateIndex
CREATE INDEX "InventoryAudit_createdAt_idx" ON "InventoryAudit"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryAuditItem_auditId_idx" ON "InventoryAuditItem"("auditId");

-- CreateIndex
CREATE INDEX "InventoryAuditItem_assetId_idx" ON "InventoryAuditItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAuditItem_auditId_assetId_key" ON "InventoryAuditItem"("auditId", "assetId");

-- AddForeignKey
ALTER TABLE "InventoryAudit" ADD CONSTRAINT "InventoryAudit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
