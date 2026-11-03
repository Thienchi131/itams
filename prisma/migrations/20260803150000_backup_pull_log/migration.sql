-- CreateTable
CREATE TABLE "BackupPullLog" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileCount" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupPullLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupPullLog_source_idx" ON "BackupPullLog"("source");

-- CreateIndex
CREATE INDEX "BackupPullLog_createdAt_idx" ON "BackupPullLog"("createdAt");
