-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_STOCK', 'ASSIGNED', 'REPAIR', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "StockInType" AS ENUM ('NEW_PURCHASE', 'RETURNED');

-- CreateEnum
CREATE TYPE "HistoryAction" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'RETURN', 'TRANSFER', 'UPDATE', 'REPAIR', 'RETIRE');

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "teamId" INTEGER,
    "positionId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetModel" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "defaultCpu" TEXT,
    "defaultRam" TEXT,
    "defaultStorage" TEXT,
    "defaultScreen" TEXT,
    "defaultGpu" TEXT,
    "note" TEXT,

    CONSTRAINT "AssetModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "assetTag" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "actualCpu" TEXT,
    "actualRam" TEXT,
    "actualStorage" TEXT,
    "actualScreen" TEXT,
    "actualGpu" TEXT,
    "color" TEXT,
    "condition" TEXT,
    "note" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_STOCK',
    "warehouseId" INTEGER,
    "currentEmployeeId" INTEGER,
    "purchaseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockInSlip" (
    "id" SERIAL NOT NULL,
    "slipNo" TEXT NOT NULL,
    "stockInDate" TIMESTAMP(3) NOT NULL,
    "stockInType" "StockInType" NOT NULL,
    "vendorName" TEXT,
    "warehouseId" INTEGER,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockInSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockInItem" (
    "id" SERIAL NOT NULL,
    "stockInSlipId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "StockInItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOutSlip" (
    "id" SERIAL NOT NULL,
    "slipNo" TEXT NOT NULL,
    "stockOutDate" TIMESTAMP(3) NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockOutSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOutItem" (
    "id" SERIAL NOT NULL,
    "stockOutSlipId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "StockOutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetHistory" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "action" "HistoryAction" NOT NULL,
    "fromEmployeeId" INTEGER,
    "toEmployeeId" INTEGER,
    "fromWarehouseId" INTEGER,
    "toWarehouseId" INTEGER,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

-- CreateIndex
CREATE INDEX "AssetModel_categoryId_idx" ON "AssetModel"("categoryId");

-- CreateIndex
CREATE INDEX "AssetModel_brand_idx" ON "AssetModel"("brand");

-- CreateIndex
CREATE INDEX "AssetModel_modelName_idx" ON "AssetModel"("modelName");

-- CreateIndex
CREATE UNIQUE INDEX "AssetModel_brand_modelName_key" ON "AssetModel"("brand", "modelName");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "Asset_assetTag_idx" ON "Asset"("assetTag");

-- CreateIndex
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Asset_warehouseId_idx" ON "Asset"("warehouseId");

-- CreateIndex
CREATE INDEX "Asset_currentEmployeeId_idx" ON "Asset"("currentEmployeeId");

-- CreateIndex
CREATE INDEX "Asset_modelId_idx" ON "Asset"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "StockInSlip_slipNo_key" ON "StockInSlip"("slipNo");

-- CreateIndex
CREATE INDEX "StockInSlip_stockInDate_idx" ON "StockInSlip"("stockInDate");

-- CreateIndex
CREATE INDEX "StockInSlip_slipNo_idx" ON "StockInSlip"("slipNo");

-- CreateIndex
CREATE INDEX "StockInItem_assetId_idx" ON "StockInItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "StockInItem_stockInSlipId_assetId_key" ON "StockInItem"("stockInSlipId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOutSlip_slipNo_key" ON "StockOutSlip"("slipNo");

-- CreateIndex
CREATE INDEX "StockOutSlip_stockOutDate_idx" ON "StockOutSlip"("stockOutDate");

-- CreateIndex
CREATE INDEX "StockOutSlip_slipNo_idx" ON "StockOutSlip"("slipNo");

-- CreateIndex
CREATE INDEX "StockOutSlip_employeeId_idx" ON "StockOutSlip"("employeeId");

-- CreateIndex
CREATE INDEX "StockOutItem_assetId_idx" ON "StockOutItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOutItem_stockOutSlipId_assetId_key" ON "StockOutItem"("stockOutSlipId", "assetId");

-- CreateIndex
CREATE INDEX "AssetHistory_assetId_idx" ON "AssetHistory"("assetId");

-- CreateIndex
CREATE INDEX "AssetHistory_action_idx" ON "AssetHistory"("action");

-- CreateIndex
CREATE INDEX "AssetHistory_createdAt_idx" ON "AssetHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetModel" ADD CONSTRAINT "AssetModel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AssetModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currentEmployeeId_fkey" FOREIGN KEY ("currentEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInItem" ADD CONSTRAINT "StockInItem_stockInSlipId_fkey" FOREIGN KEY ("stockInSlipId") REFERENCES "StockInSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInItem" ADD CONSTRAINT "StockInItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOutItem" ADD CONSTRAINT "StockOutItem_stockOutSlipId_fkey" FOREIGN KEY ("stockOutSlipId") REFERENCES "StockOutSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOutItem" ADD CONSTRAINT "StockOutItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetHistory" ADD CONSTRAINT "AssetHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
