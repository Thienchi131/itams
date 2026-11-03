-- CreateTable
CREATE TABLE "MasterOption" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterOption_type_idx" ON "MasterOption"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MasterOption_type_value_key" ON "MasterOption"("type", "value");
