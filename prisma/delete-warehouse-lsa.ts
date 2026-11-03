/**
 * Xoá toàn bộ thiết bị (Asset) đang thuộc kho "LSA" rồi xoá luôn kho LSA.
 * Dùng khi 1 lần import Excel gõ tên kho không thống nhất (VD "LSA" và
 * "Lao" cho cùng 1 địa điểm thật) khiến hệ thống tự tách ra 2 kho khác
 * nhau — script này dọn sạch nhánh "LSA" bị dư.
 *
 * KHÔNG đụng tới kho "Lao" hay bất kỳ dữ liệu nào khác — chỉ nhắm đúng kho
 * có code "LSA".
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG xoá gì cả):
 *        docker compose exec app npx tsx prisma/delete-warehouse-lsa.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy xoá thật:
 *        docker compose exec app npx tsx prisma/delete-warehouse-lsa.ts --confirm
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WAREHOUSE_CODE = "LSA";

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const warehouse = await prisma.warehouse.findFirst({
    where: { code: { equals: WAREHOUSE_CODE, mode: "insensitive" } },
  });

  if (!warehouse) {
    console.log(`Không tìm thấy kho có mã "${WAREHOUSE_CODE}" — có thể đã xoá rồi hoặc gõ sai mã.`);
    return;
  }

  console.log(`Tìm thấy kho: #${warehouse.id}  ${warehouse.code} - ${warehouse.name}`);

  const [assets, supplyCount, userCount] = await Promise.all([
    prisma.asset.findMany({ where: { warehouseId: warehouse.id } }),
    prisma.supply.count({ where: { warehouseId: warehouse.id } }),
    prisma.user.count({ where: { warehouseId: warehouse.id } }),
  ]);

  console.log(`\nSố thiết bị trong kho: ${assets.length}`);
  console.log(`Số vật tư đang gán vào kho: ${supplyCount}`);
  console.log(`Số tài khoản đang bị giới hạn xem đúng kho này: ${userCount}`);

  if (supplyCount > 0) {
    console.log(
      `\n⚠ Kho này vẫn còn ${supplyCount} vật tư — script KHÔNG xoá vật tư, cần tự chuyển kho hoặc xoá vật tư trước.`
    );
  }

  if (userCount > 0) {
    console.log(
      `\n⚠ Có ${userCount} tài khoản đang bị giới hạn xem đúng kho "${warehouse.code}" — nếu xoá kho, các tài khoản này sẽ tự động chuyển sang KHÔNG GIỚI HẠN (thấy hết mọi kho) do ràng buộc DB. Nên đổi phạm vi xem của các tài khoản đó trước (Cài đặt > Quản lý người dùng) rồi mới chạy lại với --confirm.`
    );
  }

  if (!CONFIRM) {
    console.log(`\n(Đây là DRY-RUN — chưa xoá gì cả. Chạy lại với "--confirm" để xoá thật.)`);
    return;
  }

  if (supplyCount > 0 || userCount > 0) {
    console.log(
      `\nDừng lại — còn vật tư hoặc tài khoản đang tham chiếu tới kho này (xem cảnh báo ở trên). Xử lý xong rồi chạy lại.`
    );
    return;
  }

  const assetIds = assets.map((a) => a.id);

  console.log(`\nĐang xoá ${assetIds.length} thiết bị và kho "${warehouse.code}"...`);

  await prisma.$transaction(async (tx) => {
    if (assetIds.length > 0) {
      const modelIds = [...new Set(assets.map((a) => a.modelId))];

      await tx.assetAccessory.deleteMany({ where: { assetId: { in: assetIds } } });
      await tx.assetWarranty.deleteMany({ where: { assetId: { in: assetIds } } });
      await tx.assetAssignment.deleteMany({ where: { assetId: { in: assetIds } } });
      await tx.stockOutItem.deleteMany({ where: { assetId: { in: assetIds } } });
      await tx.assetHistory.deleteMany({ where: { assetId: { in: assetIds } } });
      await tx.stockInItem.deleteMany({ where: { assetId: { in: assetIds } } });

      const deletedAssets = await tx.asset.deleteMany({ where: { id: { in: assetIds } } });
      console.log(`Đã xoá ${deletedAssets.count} thiết bị.`);

      // Model Library nào chỉ được dùng bởi đúng các asset vừa xoá (không còn
      // asset nào khác ở kho khác tham chiếu) thì dọn luôn cho gọn — model
      // vẫn còn được dùng ở nơi khác thì giữ nguyên.
      const stillUsed = await tx.asset.findMany({
        where: { modelId: { in: modelIds } },
        select: { modelId: true },
        distinct: ["modelId"],
      });
      const stillUsedIds = new Set(stillUsed.map((row) => row.modelId));
      const modelIdsToDelete = modelIds.filter((id) => !stillUsedIds.has(id));
      const deletedModels = await tx.assetModel.deleteMany({ where: { id: { in: modelIdsToDelete } } });
      console.log(`Đã xoá ${deletedModels.count} model trong Model Library không còn ai dùng.`);
    }

    await tx.warehouse.delete({ where: { id: warehouse.id } });
    console.log(`Đã xoá kho "${warehouse.code} - ${warehouse.name}".`);
  });

  console.log("\n=== HOÀN TẤT ===");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
