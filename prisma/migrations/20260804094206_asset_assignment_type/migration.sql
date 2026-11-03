-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PERMANENT', 'LOAN', 'WARRANTY_HOLD');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "assignmentType" "AssignmentType",
ADD COLUMN "assignmentDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Asset_assignmentDueAt_idx" ON "Asset"("assignmentDueAt");
