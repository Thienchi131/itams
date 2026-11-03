/**
 * Đổi tên Brand hàng loạt trên AssetModel — dùng lúc này để bỏ chữ "Phone"
 * thừa trong Brand (VD "Phone Samsung" → "Samsung", "Phone Google" →
 * "Google"), việc gõ Brand kèm chữ Loại thiết bị là thừa vì đã có cột Loại
 * thiết bị (AssetCategory) riêng rồi.
 *
 * Sửa RENAME_MAP dưới đây rồi chạy lại nếu cần đổi brand khác.
 *
 * Đổi ở CẢ 2 nơi để nhất quán:
 *   1. AssetModel.brand — dữ liệu thật đang gắn vào từng model.
 *   2. MasterOption (type="BRAND") — nguồn gợi ý cho ô chọn Brand khi tạo
 *      model mới, không đổi thì dropdown vẫn còn gợi ý brand tên cũ.
 *
 * Nếu brand đích (VD "Samsung") đã tồn tại sẵn ở MasterOption thì giữ
 * nguyên, chỉ xoá brand cũ; AssetModel.brand là string tự do (không FK) nên
 * không có rủi ro ràng buộc khi đổi.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/rename-brand.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy thật:
 *        docker compose exec app npx tsx prisma/rename-brand.ts --confirm --by="Henry"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RENAME_MAP: Record<string, string> = {
  "Phone Samsung": "Samsung",
  "Phone Google": "Google",
};

const CONFIRM = process.argv.includes("--confirm");
const byArg = process.argv.find((a) => a.startsWith("--by="));
const actorName = byArg ? byArg.slice("--by=".length).trim() : "";

async function main() {
  const entries = Object.entries(RENAME_MAP);
  let anyFound = false;

  for (const [oldBrand, newBrand] of entries) {
    const models = await prisma.assetModel.findMany({
      where: { brand: { equals: oldBrand, mode: "insensitive" } },
      include: { assets: true },
    });

    if (models.length === 0) {
      console.log(`"${oldBrand}" → "${newBrand}": không tìm thấy model nào, bỏ qua.`);
      continue;
    }

    anyFound = true;
    const totalAssets = models.reduce((s, m) => s + m.assets.length, 0);
    console.log(`"${oldBrand}" → "${newBrand}": ${models.length} model, ${totalAssets} thiết bị`);
    for (const model of models) {
      console.log(`   - ${model.brand} ${model.modelName} (${model.assets.length} thiết bị)`);
    }
  }

  if (!anyFound) {
    console.log("\nKhông có brand nào trong RENAME_MAP khớp dữ liệu hiện tại.");
    return;
  }

  if (!CONFIRM) {
    console.log(
      `\n(Đây là DRY-RUN — chưa đổi gì cả. Chạy lại với "--confirm --by=\"Tên bạn\"" để thực hiện thật.)`
    );
    return;
  }

  if (!actorName) {
    console.log(`\nDừng lại — cần truyền tên người thực hiện qua --by="Tên bạn" để ghi đúng vào log.`);
    return;
  }

  for (const [oldBrand, newBrand] of entries) {
    const result = await prisma.assetModel.updateMany({
      where: { brand: { equals: oldBrand, mode: "insensitive" } },
      data: { brand: newBrand },
    });

    if (result.count === 0) continue;

    // Dọn MasterOption: xoá gợi ý brand cũ, đảm bảo có gợi ý brand mới.
    await prisma.masterOption.deleteMany({
      where: { type: "BRAND", value: { equals: oldBrand, mode: "insensitive" } },
    });
    await prisma.masterOption.upsert({
      where: { type_value: { type: "BRAND", value: newBrand } },
      update: {},
      create: { type: "BRAND", value: newBrand },
    });

    await prisma.auditLog.create({
      data: {
        actorName,
        action: "Đổi tên Brand hàng loạt",
        targetType: "AssetModel",
        targetId: null,
        detail: `Đổi ${result.count} model từ Brand "${oldBrand}" sang "${newBrand}".`,
      },
    });

    console.log(`Đã đổi ${result.count} model từ "${oldBrand}" sang "${newBrand}".`);
  }

  console.log(`\n=== HOÀN TẤT ===`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
