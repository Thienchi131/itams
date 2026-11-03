import { PrismaClient, AssetStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin" },
  });
  const itRole = await prisma.role.upsert({
  where: { name: "IT" },
  update: {},
  create: { name: "IT" },
});

const userRole = await prisma.role.upsert({
  where: { name: "User" },
  update: {},
  create: { name: "User" },
});

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      fullName: "System Admin",
      password: "admin123",
      roleId: adminRole.id,
    },
  });

  await prisma.user.upsert({
  where: { username: "it" },
  update: {},
  create: {
    username: "it",
    fullName: "IT Support",
    password: "it123",
    roleId: itRole.id,
  },
});

await prisma.user.upsert({
  where: { username: "user" },
  update: {},
  create: {
    username: "user",
    fullName: "Viewer User",
    password: "user123",
    roleId: userRole.id,
  },
});

  const itTeam = await prisma.team.upsert({
    where: { name: "IT" },
    update: {},
    create: { name: "IT" },
  });

  const financeTeam = await prisma.team.upsert({
    where: { name: "Finance" },
    update: {},
    create: { name: "Finance" },
  });

  const itSupport = await prisma.position.upsert({
    where: { name: "IT Support" },
    update: {},
    create: { name: "IT Support" },
  });

  const accountant = await prisma.position.upsert({
    where: { name: "Accountant" },
    update: {},
    create: { name: "Accountant" },
  });

  const empA = await prisma.employee.upsert({
    where: { employeeCode: "EMP-0001" },
    update: {},
    create: {
      employeeCode: "EMP-0001",
      fullName: "Nguyễn Văn A",
      email: "a@company.com",
      teamId: itTeam.id,
      positionId: itSupport.id,
    },
  });

  await prisma.employee.upsert({
    where: { employeeCode: "EMP-0002" },
    update: {},
    create: {
      employeeCode: "EMP-0002",
      fullName: "Trần Văn B",
      email: "b@company.com",
      teamId: financeTeam.id,
      positionId: accountant.id,
    },
  });

  // Kho thực tế theo khu vực (mã 3 ký tự do vận hành cung cấp).
  // `code` là khoá duy nhất, dùng sau này để phân quyền user theo từng local
  // (VD: IT DXB chỉ thấy kho DXB, chỉ Admin thấy/sửa toàn bộ).
  const countryWarehouses: { code: string; name: string }[] = [
    { code: "LSA", name: "Laos" },
    { code: "TLD", name: "Thailand" },
    { code: "CPP", name: "Cambodia" },
    { code: "DXB", name: "Dubai" },
    { code: "VNA", name: "Vietnam" },
    { code: "PHL", name: "Philippines" },
    { code: "MLS", name: "Malaysia" },
    { code: "LKA", name: "Sri Lanka" },
    { code: "GEO", name: "Georgia" },
    { code: "NGA", name: "Nigeria" },
    { code: "BGD", name: "Bangladesh" },
  ];

  const warehousesByCode = new Map<string, { id: number }>();

  for (const { code, name } of countryWarehouses) {
    const warehouse = await prisma.warehouse.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });

    warehousesByCode.set(code, warehouse);
  }

  const dubaiWarehouse = warehousesByCode.get("DXB")!;

  await prisma.vendor.upsert({
    where: { name: "Apple UAE" },
    update: {},
    create: { name: "Apple UAE" },
  });

  const laptopCategory = await prisma.assetCategory.upsert({
    where: { name: "Laptop" },
    update: {},
    create: { name: "Laptop" },
  });

  const macbookModel = await prisma.assetModel.upsert({
    where: {
      brand_modelName: {
        brand: "Apple",
        modelName: "MacBook Pro 14 M4",
      },
    },
    update: {},
    create: {
      categoryId: laptopCategory.id,
      brand: "Apple",
      modelName: "MacBook Pro 14 M4",
      defaultCpu: "Apple M4",
      defaultRam: "24GB",
      defaultStorage: "512GB",
      defaultScreen: "14 inch",
    },
  });

  const dellModel = await prisma.assetModel.upsert({
    where: {
      brand_modelName: {
        brand: "Dell",
        modelName: "Latitude 7420",
      },
    },
    update: {},
    create: {
      categoryId: laptopCategory.id,
      brand: "Dell",
      modelName: "Latitude 7420",
      defaultCpu: "Intel Core i5",
      defaultRam: "16GB",
      defaultStorage: "512GB",
      defaultScreen: "14 inch",
    },
  });

  const asset1 = await prisma.asset.upsert({
    where: { assetTag: "IT-260626-0000001" },
    update: {},
    create: {
      assetTag: "IT-260626-0000001",
      serialNumber: "SN-MBP-001",
      modelId: macbookModel.id,
      actualCpu: "Apple M4",
      actualRam: "24GB",
      actualStorage: "512GB",
      actualScreen: "14 inch",
      condition: "Good",
      status: AssetStatus.ASSIGNED,
      currentEmployeeId: empA.id,
      warehouseId: dubaiWarehouse.id,
      purchaseDate: new Date("2026-06-26"),
    },
  });

  await prisma.asset.upsert({
    where: { assetTag: "IT-260626-0000002" },
    update: {},
    create: {
      assetTag: "IT-260626-0000002",
      serialNumber: "SN-DELL-002",
      modelId: dellModel.id,
      actualCpu: "Intel Core i5",
      actualRam: "16GB",
      actualStorage: "512GB",
      actualScreen: "14 inch",
      condition: "Good",
      status: AssetStatus.IN_STOCK,
      warehouseId: dubaiWarehouse.id,
      purchaseDate: new Date("2026-06-26"),
    },
  });

  await prisma.assetAccessory.createMany({
    data: [
      { assetId: asset1.id, name: "Adapter", quantity: 1 },
      { assetId: asset1.id, name: "Cáp sạc", quantity: 1 },
    ],
    skipDuplicates: true,
  });

  await prisma.assetWarranty.create({
    data: {
      assetId: asset1.id,
      provider: "Apple UAE",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2027-06-26"),
      note: "Standard warranty",
    },
  });
const masterOptions = [
  // Category
  ["CATEGORY", "iPhone"],
  ["CATEGORY", "MacBook"],
  ["CATEGORY", "Laptop"],
  ["CATEGORY", "iPad"],
  ["CATEGORY", "Wacom"],
  ["CATEGORY", "YubiKey"],
  ["CATEGORY", "Màn hình"],
  ["CATEGORY", "Điện thoại"],

  // Brand
  ["BRAND", "Apple"],
  ["BRAND", "Dell"],
  ["BRAND", "HP"],
  ["BRAND", "Lenovo"],
  ["BRAND", "Wacom"],
  ["BRAND", "Yubico"],

  // CPU
  ["CPU", "Apple M1"],
  ["CPU", "Apple M2"],
  ["CPU", "Apple M3"],
  ["CPU", "Apple M4"],
  ["CPU", "Intel i3"],
  ["CPU", "Intel i5"],
  ["CPU", "Intel i7"],
  ["CPU", "Intel i9"],

  // RAM
  ["RAM", "4GB"],
  ["RAM", "8GB"],
  ["RAM", "12GB"],
  ["RAM", "16GB"],
  ["RAM", "24GB"],
  ["RAM", "32GB"],
  ["RAM", "64GB"],
  ["RAM", "128GB"],

  // SSD
  ["STORAGE", "64GB"],
  ["STORAGE", "128GB"],
  ["STORAGE", "256GB"],
  ["STORAGE", "512GB"],
  ["STORAGE", "1TB"],
  ["STORAGE", "2TB"],
  ["STORAGE", "4TB"],
  ["STORAGE", "6TB"],

  // Screen
  ["SCREEN", `11"`],
  ["SCREEN", `13"`],
  ["SCREEN", `14"`],
  ["SCREEN", `15.6"`],
  ["SCREEN", `24"`],
  ["SCREEN", `27"`],
  ["SCREEN", `32"`],
];

for (const [type, value] of masterOptions) {
  await prisma.masterOption.upsert({
    where: {
      type_value: {
        type,
        value,
      },
    },
    update: {},
    create: {
      type,
      value,
    },
  });
}
  console.log("Seed data completed.");
  
}

main()

  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });