/**
 * Gộp NHIỀU Loại thiết bị (AssetCategory) khác tên hẳn nhau vào 1 tên chung
 * — khác với prisma/merge-duplicate-categories.ts (chỉ gộp các category
 * trùng tên do lệch HOA/thường, tự động dò). Script này dùng khi Admin chủ
 * động muốn gộp các category có Ý NGHĨA giống nhau nhưng đặt tên khác nhau,
 * VD "Phone Samsung" + "Phone Google" → gộp chung thành "Điện thoại".
 *
 * SOURCE_NAMES: tên các category sẽ được gộp (so khớp KHÔNG phân biệt
 * HOA/thường). Nếu 1 category tên TARGET_NAME đã tồn tại sẵn thì dùng luôn
 * làm nơi giữ lại; nếu chưa có, category đầu tiên khớp trong SOURCE_NAMES sẽ
 * được ĐỔI TÊN thành TARGET_NAME rồi làm nơi giữ lại, các category còn lại
 * chuyển hết Model sang rồi bị xoá.
 *
 * Sửa lại 2 hằng số dưới đây rồi chạy lại nếu cần gộp nhóm khác.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/merge-named-categories.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy thật:
 *        docker compose exec app npx tsx prisma/merge-named-categories.ts --confirm --by="Henry"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_NAMES = ["Phone Samsung", "Phone Google"];
const TARGET_NAME = "Điện thoại";

const CONFIRM = process.argv.includes("--confirm");
const byArg = process.argv.find((a) => a.startsWith("--by="));
const actorName = byArg ? byArg.slice("--by=".length).trim() : "";

async function main() {
  const existingTarget = await prisma.assetCategory.findFirst({
    where: { name: { equals: TARGET_NAME, mode: "insensitive" } },
    include: { models: { include: { assets: true } } },
  });

  const sources = await prisma.assetCategory.findMany({
    where: {
      OR: SOURCE_NAMES.map((name) => ({
        name: { equals: name, mode: "insensitive" as const },
      })),
    },
    include: { models: { include: { assets: true } } },
  });

  if (sources.length === 0 && !existingTarget) {
    console.log(
      `Không tìm thấy category nào khớp với [${SOURCE_NAMES.join(", ")}] hoặc "${TARGET_NAME}". Kiểm tra lại tên cho đúng chính tả trong DB rồi sửa SOURCE_NAMES.`
    );
    return;
  }

  // Nơi giữ lại: ưu tiên category đã sẵn tên TARGET_NAME nếu có, không thì
  // dùng category đầu tiên khớp SOURCE_NAMES (đổi tên nó thành TARGET_NAME).
  const keep = existingTarget ?? sources[0];
  const remove = sources.filter((c) => c.id !== keep.id);

  console.log(`Sẽ gộp thành: "${TARGET_NAME}"\n`);
  console.log(
    `   GIỮ LẠI  #${keep.id}  "${keep.name}"${keep.name !== TARGET_NAME ? `  → đổi tên thành "${TARGET_NAME}"` : ""}  (${keep.models.length} model, ${keep.models.reduce((s, m) => s + m.assets.length, 0)} thiết bị)`
  );

  if (remove.length === 0) {
    console.log(`\nKhông còn category nào khác cần gộp vào — có thể chỉ cần đổi tên "${keep.name}" thành "${TARGET_NAME}".`);
  }

  for (const category of remove) {
    const assetCount = category.models.reduce((s, m) => s + m.assets.length, 0);
    console.log(
      `   GỘP+XOÁ  #${category.id}  "${category.name}"  (${category.models.length} model, ${assetCount} thiết bị — model sẽ chuyển sang "${TARGET_NAME}" trước khi xoá)`
    );
    for (const model of category.models) {
      console.log(`              - Model: ${model.brand} ${model.modelName} (${model.assets.length} thiết bị)`);
    }
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

  await prisma.$transaction(async (tx) => {
    if (keep.name !== TARGET_NAME) {
      await tx.assetCategory.update({ where: { id: keep.id }, data: { name: TARGET_NAME } });
    }

    for (const category of remove) {
      await tx.assetModel.updateMany({
        where: { categoryId: category.id },
        data: { categoryId: keep.id },
      });
      await tx.assetCategory.delete({ where: { id: category.id } });
    }

    await tx.auditLog.create({
      data: {
        actorName,
        action: "Gộp Loại thiết bị",
        targetType: "AssetCategory",
        targetId: String(keep.id),
        detail: `Giữ lại/đổi tên thành: "${TARGET_NAME}" (#${keep.id}). Đã gộp và xoá: ${remove.map((c) => `"${c.name}" (#${c.id})`).join(", ") || "(không có)"}.`,
      },
    });
  });

  console.log(`\n=== HOÀN TẤT — đã gộp thành "${TARGET_NAME}" (#${keep.id}) ===`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
