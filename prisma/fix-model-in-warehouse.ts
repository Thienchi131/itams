/**
 * Sửa NHẦM MODEL cho các thiết bị TRONG 1 KHO CỤ THỂ — khác với gộp model
 * (MergeModelsModal ở /models, đổi TOÀN BỘ thiết bị trên mọi kho đang dùng
 * model đó). Ở đây chỉ đổi modelId cho đúng nhóm thiết bị bị nhập sai lúc
 * tạo (VD: kho SUBIC nhập nhầm "Yubikey 5C NFC" trong khi thực tế là
 * "Yubikey 5 NFC"), các thiết bị CÙNG MODEL nhưng ở kho khác giữ nguyên
 * không đụng tới — vì model đích/nguồn vẫn cùng tồn tại hợp lệ ở nơi khác.
 *
 * Sửa 3 hằng số dưới đây rồi chạy lại nếu cần áp dụng cho kho/model khác.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/fix-model-in-warehouse.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy thật — BẮT BUỘC truyền tên người thực
 *      hiện (--by=) để log ghi đúng ai đã làm việc này:
 *        docker compose exec app npx tsx prisma/fix-model-in-warehouse.ts --confirm --by="Henry"
 */

import { PrismaClient, HistoryAction } from "@prisma/client";

const prisma = new PrismaClient();

// Chỉ cần khớp DUY NHẤT 1 kho để tránh sửa nhầm kho khác.
const WAREHOUSE_MATCH_KEYWORDS = ["SUBIC"];

// Model ĐANG SAI (nguồn) và model ĐÚNG (đích) — so khớp brand+modelName
// KHÔNG phân biệt hoa/thường.
const SOURCE_MODEL = { brand: "Yubico", modelName: "Yubikey 5C NFC" };
const TARGET_MODEL = { brand: "Yubico", modelName: "Yubikey 5 NFC" };

const CONFIRM = process.argv.includes("--confirm");
const byArg = process.argv.find((a) => a.startsWith("--by="));
const actorName = byArg ? byArg.slice("--by=".length).trim() : "";

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    where: {
      OR: WAREHOUSE_MATCH_KEYWORDS.flatMap((kw) => [
        { code: { contains: kw, mode: "insensitive" as const } },
        { name: { contains: kw, mode: "insensitive" as const } },
      ]),
    },
  });

  if (warehouses.length !== 1) {
    console.log(
      `Khớp ${warehouses.length} kho với từ khoá [${WAREHOUSE_MATCH_KEYWORDS.join(", ")}] — cần khớp ĐÚNG 1 kho. Sửa lại WAREHOUSE_MATCH_KEYWORDS rồi chạy lại.`
    );
    warehouses.forEach((w) => console.log(`   #${w.id}  ${w.code} - ${w.name}`));
    return;
  }

  const warehouse = warehouses[0];

  const sourceModel = await prisma.assetModel.findFirst({
    where: {
      brand: { equals: SOURCE_MODEL.brand, mode: "insensitive" },
      modelName: { equals: SOURCE_MODEL.modelName, mode: "insensitive" },
    },
  });
  const targetModel = await prisma.assetModel.findFirst({
    where: {
      brand: { equals: TARGET_MODEL.brand, mode: "insensitive" },
      modelName: { equals: TARGET_MODEL.modelName, mode: "insensitive" },
    },
  });

  if (!sourceModel) {
    console.log(`Không tìm thấy model NGUỒN "${SOURCE_MODEL.brand} ${SOURCE_MODEL.modelName}".`);
    return;
  }
  if (!targetModel) {
    console.log(`Không tìm thấy model ĐÍCH "${TARGET_MODEL.brand} ${TARGET_MODEL.modelName}".`);
    return;
  }
  if (sourceModel.id === targetModel.id) {
    console.log(`Model nguồn và đích đang trùng nhau (#${sourceModel.id}) — dừng lại, không có gì để sửa.`);
    return;
  }

  console.log(`Kho: #${warehouse.id}  ${warehouse.code} - ${warehouse.name}`);
  console.log(`Model NGUỒN (sai): #${sourceModel.id}  ${sourceModel.brand} ${sourceModel.modelName}`);
  console.log(`Model ĐÍCH  (đúng): #${targetModel.id}  ${targetModel.brand} ${targetModel.modelName}`);

  const assets = await prisma.asset.findMany({
    where: { warehouseId: warehouse.id, modelId: sourceModel.id },
  });

  console.log(`\nSố thiết bị sẽ sửa (chỉ trong kho này): ${assets.length}`);
  assets.forEach((a) => console.log(`   - ${a.assetTag}  SN: ${a.serialNumber}`));

  if (assets.length === 0) {
    console.log(`\nKhông có thiết bị nào cần sửa trong kho này.`);
    return;
  }

  if (!CONFIRM) {
    console.log(
      `\n(Đây là DRY-RUN — chưa đổi gì cả. Chạy lại với "--confirm --by=\"Tên bạn\"" để thực hiện thật.)`
    );
    return;
  }

  if (!actorName) {
    console.log(`\nDừng lại — cần truyền tên người thực hiện qua --by="Tên bạn" để ghi đúng vào log lịch sử.`);
    return;
  }

  console.log(`\nĐang sửa ${assets.length} thiết bị (thực hiện bởi: ${actorName})...`);

  for (const asset of assets) {
    await prisma.$transaction([
      prisma.asset.update({
        where: { id: asset.id },
        data: { modelId: targetModel.id },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.UPDATE,
          fromWarehouseId: warehouse.id,
          toWarehouseId: warehouse.id,
          note: `Sửa nhầm model (script fix-model-in-warehouse.ts) — "${sourceModel.brand} ${sourceModel.modelName}" → "${targetModel.brand} ${targetModel.modelName}", chỉ áp dụng kho ${warehouse.code} — SN: ${asset.serialNumber}`,
          createdBy: actorName,
        },
      }),
    ]);
  }

  console.log(`\n=== HOÀN TẤT — đã sửa ${assets.length} thiết bị sang model "${targetModel.brand} ${targetModel.modelName}" ===`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
