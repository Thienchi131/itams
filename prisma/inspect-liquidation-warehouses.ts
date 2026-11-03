/**
 * Script CHỈ ĐỌC (không đổi/xoá gì) — liệt kê mọi kho có code/name khớp
 * "KTL", "VTE", hoặc "Thanh Lý"/"Thanh Ly", kèm số thiết bị trong từng kho
 * (chia theo status) — dùng để kiểm tra xem có bị trùng/nhân đôi kho hay
 * không (VD do import Excel gõ tên kho không thống nhất, từng gặp với
 * "LSA" vs "Lao") trước khi quyết định xoá gì.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   docker compose exec app npx tsx prisma/inspect-liquidation-warehouses.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MATCH_KEYWORDS = ["KTL", "VTE", "Thanh Lý", "Thanh Ly"];

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    where: {
      OR: MATCH_KEYWORDS.flatMap((kw) => [
        { code: { contains: kw, mode: "insensitive" as const } },
        { name: { contains: kw, mode: "insensitive" as const } },
      ]),
    },
    include: { region: true },
    orderBy: { id: "asc" },
  });

  if (warehouses.length === 0) {
    console.log(`Không tìm thấy kho nào khớp từ khoá: ${MATCH_KEYWORDS.join(", ")}.`);
    return;
  }

  console.log(`Tìm thấy ${warehouses.length} kho khớp:\n`);

  for (const w of warehouses) {
    const [total, byStatus, supplyCount, userScopedCount] = await Promise.all([
      prisma.asset.count({ where: { warehouseId: w.id } }),
      prisma.asset.groupBy({
        by: ["status"],
        where: { warehouseId: w.id },
        _count: true,
      }),
      prisma.supply.count({ where: { warehouseId: w.id } }),
      prisma.user.count({ where: { warehouseId: w.id } }),
    ]);

    console.log(`#${w.id}  ${w.code} - ${w.name}${w.region ? `  (Region: ${w.region.name})` : "  (Region: —)"}`);
    console.log(`   Tổng thiết bị: ${total}`);
    for (const row of byStatus) {
      console.log(`     ${row.status}: ${row._count}`);
    }
    console.log(`   Vật tư đang gán vào kho: ${supplyCount}`);
    console.log(`   Tài khoản bị giới hạn xem đúng kho này: ${userScopedCount}`);
    console.log("");
  }

  console.log(
    `Đây là dữ liệu THẬT trong DB — không có gì bị xoá/đổi bởi script này. ` +
      `Xem kỹ trước khi quyết định xoá kho nào.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
