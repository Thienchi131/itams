import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  console.log("Deleting data...");

  await prisma.assetHistory.deleteMany();

  await prisma.assetWarranty.deleteMany();

  await prisma.assetAccessory.deleteMany();

  await prisma.stockOutItem.deleteMany();
  await prisma.stockInItem.deleteMany();

  await prisma.stockOutSlip.deleteMany();
  await prisma.stockInSlip.deleteMany();

  await prisma.asset.deleteMany();

  await prisma.employee.deleteMany();

  await prisma.warehouse.deleteMany();

  await prisma.position.deleteMany();
  await prisma.team.deleteMany();

  await prisma.assetModel.deleteMany();

  await prisma.assetCategory.deleteMany();

  console.log("Done.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });