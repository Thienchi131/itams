/**
 * Gộp các Loại thiết bị (AssetCategory) bị trùng do khác HOA/thường — VD
 * "MacBook" và "Macbook" là 2 dòng riêng biệt trong DB vì AssetCategory.name
 * @unique so khớp phân biệt HOA/thường (case-sensitive), trong khi
 * createModelAction() lại dùng prisma.assetCategory.upsert({ where: { name } })
 * — ai gõ lệch case lúc tạo Model mới sẽ tự tạo thêm 1 category mới thay vì
 * dùng lại cái đã có.
 *
 * Tự động dò TẤT CẢ các nhóm category trùng tên (không phân biệt HOA/thường),
 * không chỉ riêng MacBook — để tiện dùng lại nếu phát sinh case tương tự sau
 * này.
 *
 * Với mỗi nhóm trùng:
 *   - GIỮ LẠI category có nhiều AssetModel hơn (thường là bản đang được dùng
 *     thật). Nếu bằng nhau, giữ category có id nhỏ hơn (tạo trước).
 *   - Chuyển toàn bộ AssetModel đang thuộc các category còn lại sang category
 *     giữ lại (KHÔNG đụng tới Asset — Asset chỉ liên kết qua AssetModel, tự
 *     động đi theo).
 *   - Xoá các category rỗng còn lại.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/merge-duplicate-categories.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy thật:
 *        docker compose exec app npx tsx prisma/merge-duplicate-categories.ts --confirm --by="Henry"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRM = process.argv.includes("--confirm");
const byArg = process.argv.find((a) => a.startsWith("--by="));
const actorName = byArg ? byArg.slice("--by=".length).trim() : "";

async function main() {
  const categories = await prisma.assetCategory.findMany({
    include: { models: { include: { assets: true } } },
    orderBy: { id: "asc" },
  });

  const groups = new Map<string, typeof categories>();
  for (const category of categories) {
    const key = category.name.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(category);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.values()].filter((list) => list.length > 1);

  if (duplicateGroups.length === 0) {
    console.log("Không tìm thấy Loại thiết bị nào bị trùng tên (khác HOA/thường).");
    return;
  }

  console.log(`Tìm thấy ${duplicateGroups.length} nhóm Loại thiết bị bị trùng:\n`);

  const plan = duplicateGroups.map((group) => {
    const sorted = [...group].sort((a, b) => {
      if (b.models.length !== a.models.length) return b.models.length - a.models.length;
      return a.id - b.id;
    });
    const keep = sorted[0];
    const remove = sorted.slice(1);
    return { keep, remove };
  });

  for (const { keep, remove } of plan) {
    const keepAssetCount = keep.models.reduce((sum, m) => sum + m.assets.length, 0);
    console.log(`Nhóm "${keep.name}":`);
    console.log(
      `   GIỮ LẠI  #${keep.id}  "${keep.name}"  (${keep.models.length} model, ${keepAssetCount} thiết bị)`
    );
    for (const category of remove) {
      const assetCount = category.models.reduce((sum, m) => sum + m.assets.length, 0);
      console.log(
        `   XOÁ      #${category.id}  "${category.name}"  (${category.models.length} model, ${assetCount} thiết bị — model sẽ được chuyển sang "${keep.name}" trước khi xoá)`
      );
      for (const model of category.models) {
        console.log(`              - Model: ${model.brand} ${model.modelName} (${model.assets.length} thiết bị)`);
      }
    }
    console.log("");
  }

  if (!CONFIRM) {
    console.log(
      `(Đây là DRY-RUN — chưa đổi gì cả. Chạy lại với "--confirm --by=\"Tên bạn\"" để thực hiện thật.)`
    );
    return;
  }

  if (!actorName) {
    console.log(`Dừng lại — cần truyền tên người thực hiện qua --by="Tên bạn" để ghi đúng vào log.`);
    return;
  }

  for (const { keep, remove } of plan) {
    for (const category of remove) {
      await prisma.$transaction([
        prisma.assetModel.updateMany({
          where: { categoryId: category.id },
          data: { categoryId: keep.id },
        }),
        prisma.assetCategory.delete({ where: { id: category.id } }),
        prisma.auditLog.create({
          data: {
            actorName,
            action: "Gộp Loại thiết bị",
            targetType: "AssetCategory",
            targetId: String(keep.id),
            detail: `Giữ lại: "${keep.name}" (#${keep.id}). Đã gộp và xoá: "${category.name}" (#${category.id}) — chuyển ${category.models.length} model sang "${keep.name}".`,
          },
        }),
      ]);
      console.log(`Đã gộp "${category.name}" (#${category.id}) vào "${keep.name}" (#${keep.id}).`);
    }
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
