/*
  Warnings:

  - A unique constraint covering the columns `[assetCode]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `assetCode` to the `Asset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "assetCode" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AssetAccessory" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetWarranty" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "provider" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetWarranty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAccessory_assetId_idx" ON "AssetAccessory"("assetId");

-- CreateIndex
CREATE INDEX "AssetAccessory_name_idx" ON "AssetAccessory"("name");

-- CreateIndex
CREATE INDEX "AssetWarranty_assetId_idx" ON "AssetWarranty"("assetId");

-- CreateIndex
CREATE INDEX "AssetWarranty_endDate_idx" ON "AssetWarranty"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetCode_key" ON "Asset"("assetCode");

-- AddForeignKey
ALTER TABLE "AssetAccessory" ADD CONSTRAINT "AssetAccessory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetWarranty" ADD CONSTRAINT "AssetWarranty_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
