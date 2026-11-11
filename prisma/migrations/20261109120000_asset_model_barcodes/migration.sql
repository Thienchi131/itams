-- Mã UPC/EAN trên hộp sản phẩm gắn vào Model (nhiều mã / 1 model).

-- CreateTable
CREATE TABLE "AssetModelBarcode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetModelBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetModelBarcode_code_key" ON "AssetModelBarcode"("code");

-- CreateIndex
CREATE INDEX "AssetModelBarcode_modelId_idx" ON "AssetModelBarcode"("modelId");

-- AddForeignKey
ALTER TABLE "AssetModelBarcode" ADD CONSTRAINT "AssetModelBarcode_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AssetModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
