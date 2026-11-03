-- CreateEnum
CREATE TYPE "AssetModelTag" AS ENUM ('OK', 'BACKUP');

-- AlterTable
ALTER TABLE "AssetModel" ADD COLUMN "tag" "AssetModelTag";

-- CreateIndex
CREATE INDEX "AssetModel_tag_idx" ON "AssetModel"("tag");
