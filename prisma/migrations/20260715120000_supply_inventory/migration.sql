-- Kho vật tư (hàng tiêu hao tính theo số lượng) — module mới, độc lập với
-- Asset/Warehouse hiện có.

-- CreateEnum
CREATE TYPE "SupplyTransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUST');

-- CreateTable
CREATE TABLE "Supply" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyTransaction" (
    "id" SERIAL NOT NULL,
    "supplyId" INTEGER NOT NULL,
    "type" "SupplyTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supply_code_key" ON "Supply"("code");

-- CreateIndex
CREATE INDEX "Supply_code_idx" ON "Supply"("code");

-- CreateIndex
CREATE INDEX "Supply_name_idx" ON "Supply"("name");

-- CreateIndex
CREATE INDEX "SupplyTransaction_supplyId_idx" ON "SupplyTransaction"("supplyId");

-- CreateIndex
CREATE INDEX "SupplyTransaction_type_idx" ON "SupplyTransaction"("type");

-- CreateIndex
CREATE INDEX "SupplyTransaction_createdAt_idx" ON "SupplyTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "SupplyTransaction" ADD CONSTRAINT "SupplyTransaction_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "Supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
