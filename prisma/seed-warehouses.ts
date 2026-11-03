/**
 * Chỉ seed 11 kho theo khu vực — KHÔNG đụng tới User/Employee/Asset nào cả.
 * An toàn để chạy trên production (idempotent — chạy lại nhiều lần không
 * tạo trùng, chỉ cập nhật `name` nếu `code` đã tồn tại).
 *
 * Cách chạy (trong container):
 *   docker compose exec app npx tsx prisma/seed-warehouses.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  for (const { code, name } of countryWarehouses) {
    // Chỉ set regionId lúc TẠO MỚI (mặc định 1 kho = 1 region cùng tên,
    // giống hành vi trước khi có khái niệm Region) — cố tình KHÔNG đụng tới
    // regionId khi update, vì Admin có thể đã gộp kho này vào 1 Region khác
    // qua trang Cài đặt > Khu vực (vd nhiều kho con của Dubai dùng chung 1
    // Region "Dubai"); script idempotent này không được phép ghi đè lại.
    const existed = await prisma.warehouse.findUnique({ where: { code } });

    if (existed) {
      const warehouse = await prisma.warehouse.update({
        where: { code },
        data: { name },
      });
      console.log(`OK: ${warehouse.code} - ${warehouse.name}`);
      continue;
    }

    const region = await prisma.region.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    const warehouse = await prisma.warehouse.create({
      data: { code, name, regionId: region.id },
    });

    console.log(`OK: ${warehouse.code} - ${warehouse.name}`);
  }

  console.log(`\nHoàn tất — đã seed ${countryWarehouses.length} kho.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
