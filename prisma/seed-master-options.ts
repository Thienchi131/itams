/**
 * Nạp danh mục MasterOption (Loại thiết bị / Brand / CPU / RAM / SSD /
 * Screen) dùng cho các dropdown "Chọn..." trong trang Thêm/Sửa Model.
 *
 * Script này an toàn chạy nhiều lần (idempotent, dùng upsert) và KHÔNG đụng
 * tới bất kỳ data nào khác (Employee, Asset, User, ...) — khác với
 * prisma/seed.ts vốn còn tạo cả data demo (nhân viên/thiết bị/tài khoản
 * giả) không phù hợp để chạy trên production.
 *
 * Cách chạy (trong container):
 *   docker compose exec app npx tsx prisma/seed-master-options.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const masterOptions: [string, string][] = [
  // Loại thiết bị
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

  // SSD / Storage
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

async function main() {
  let created = 0;

  for (const [type, value] of masterOptions) {
    const result = await prisma.masterOption.upsert({
      where: { type_value: { type, value } },
      update: {},
      create: { type, value },
    });

    if (result) created++;
  }

  console.log(`\n=== HOÀN TẤT ===`);
  console.log(`Đã đảm bảo ${masterOptions.length} MasterOption tồn tại (upsert, không tạo trùng).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
