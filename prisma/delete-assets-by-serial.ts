/**
 * Xoá đúng các asset theo Serial Number chỉ định — dùng khi lỡ tay nhập
 * nhầm vài thiết bị qua form Nhập kho (không phải Import Excel) và muốn xoá
 * sạch, không đụng gì khác.
 *
 * Xoá theo đúng danh sách serial number liệt kê dưới đây (SERIALS_TO_DELETE)
 * — không dùng suy đoán theo thời gian, an toàn 100% chỉ nhắm đúng 3 thiết
 * bị này.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG xoá gì cả):
 *        docker compose exec app npx tsx prisma/delete-assets-by-serial.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy xoá thật:
 *        docker compose exec app npx tsx prisma/delete-assets-by-serial.ts --confirm
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SERIALS_TO_DELETE = ["m5qv6cp9ng", "G2KTWFVMHF", "G79RC4K6LX"];

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const assets = await prisma.asset.findMany({
    where: { serialNumber: { in: SERIALS_TO_DELETE } },
  });

  const foundSerials = new Set(assets.map((a) => a.serialNumber));
  const notFound = SERIALS_TO_DELETE.filter((s) => !foundSerials.has(s));

  console.log(`Tìm thấy ${assets.length}/${SERIALS_TO_DELETE.length} thiết bị:`);
  for (const a of assets) {
    console.log(`  - Tag: ${a.assetTag}  Serial: ${a.serialNumber}  (đang giữ bởi employeeId: ${a.currentEmployeeId ?? "không ai / trong kho"})`);
  }

  if (notFound.length > 0) {
    console.log(`\nKhông tìm thấy (có thể đã xoá rồi hoặc gõ sai serial): ${notFound.join(", ")}`);
  }

  if (assets.length === 0) {
    console.log("\nKhông có gì để xoá.");
    return;
  }

  if (!CONFIRM) {
    console.log(`\n(Đây là DRY-RUN — chưa xoá gì cả. Chạy lại với "--confirm" để xoá thật.)`);
    return;
  }

  const assetIds = assets.map((a) => a.id);

  console.log(`\nĐang xoá ${assetIds.length} thiết bị (và toàn bộ dữ liệu liên quan)...`);

  await prisma.$transaction(async (tx) => {
    await tx.assetAccessory.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.assetWarranty.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.assetAssignment.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.stockOutItem.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.assetHistory.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.stockInItem.deleteMany({ where: { assetId: { in: assetIds } } });

    const deleted = await tx.asset.deleteMany({ where: { id: { in: assetIds } } });

    console.log(`\n=== HOÀN TẤT ===`);
    console.log(`Đã xoá ${deleted.count} thiết bị.`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
