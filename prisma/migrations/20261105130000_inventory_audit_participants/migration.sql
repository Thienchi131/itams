-- IT được chỉ định tham gia từng đợt kiểm kê (chỉ những IT này thấy đợt đó).

-- CreateTable
CREATE TABLE "InventoryAuditParticipant" (
    "auditId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAuditParticipant_pkey" PRIMARY KEY ("auditId","userId")
);

-- CreateIndex
CREATE INDEX "InventoryAuditParticipant_userId_idx" ON "InventoryAuditParticipant"("userId");

-- AddForeignKey
ALTER TABLE "InventoryAuditParticipant" ADD CONSTRAINT "InventoryAuditParticipant_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditParticipant" ADD CONSTRAINT "InventoryAuditParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
