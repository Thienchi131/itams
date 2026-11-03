/*
  Warnings:

  - A unique constraint covering the columns `[modelCode]` on the table `AssetModel` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AssetModel" ADD COLUMN     "modelCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AssetModel_modelCode_key" ON "AssetModel"("modelCode");
