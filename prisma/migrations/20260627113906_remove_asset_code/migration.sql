/*
  Warnings:

  - You are about to drop the column `assetCode` on the `Asset` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Asset_assetCode_key";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "assetCode";
