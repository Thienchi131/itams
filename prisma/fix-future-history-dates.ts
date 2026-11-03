/**
 * Sửa các bản ghi bị dính lỗi "ngày nằm ở tương lai" — phát hiện khi chuông
 * thông báo không bao giờ đánh dấu đọc hết được (badge cứ hiện lại số cũ dù
 * đã bấm đọc). Nguyên nhân: 1 số dòng trong file Excel nhập kho ("Fill Kho
 * Lào.xlsx") có cột ngày bị đọc/nhập sai, sinh ra ngày SAU thời điểm import
 * thật (VD: 07/11/2026 dù import lúc 19/07/2026) — ngày này bị ghi thẳng vào
 * AssetHistory.createdAt (và có thể cả Asset.purchaseDate, cùng đọc từ 1 cột
 * Excel). Vì badge tính "chưa đọc" theo createdAt > lần đọc cuối, mà ngày
 * tương lai thì mãi mãi lớn hơn "lần đọc cuối" dù đọc lúc nào, nên badge kẹt
 * cứng không bao giờ về 0 được.
 *
 * Script này KHÔNG đoán lại ngày đúng là gì (không thể biết chắc) — chỉ đơn
 * giản đưa các ngày phi lý (sau "hôm nay") về đúng thời điểm chạy script này
 * (coi như mới phát hiện/xử lý ngay bây giờ), để dữ liệu không còn nằm ở
 * tương lai nữa và chuông thông báo hoạt động lại bình thường.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG sửa gì cả):
 *        docker compose exec app npx tsx prisma/fix-future-history-dates.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy sửa thật:
 *        docker compose exec app npx tsx prisma/fix-future-history-dates.ts --confirm
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const now = new Date();

  const [badHistories, badAssets] = await Promise.all([
    prisma.assetHistory.findMany({
      where: { createdAt: { gt: now } },
      include: { asset: { select: { assetTag: true, serialNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { purchaseDate: { gt: now } },
      select: { id: true, assetTag: true, serialNumber: true, purchaseDate: true },
      orderBy: { purchaseDate: "desc" },
    }),
  ]);

  console.log(`Thời điểm chạy script: ${now.toISOString()}`);
  console.log("");
  console.log(
    `Tìm thấy ${badHistories.length} dòng AssetHistory có createdAt nằm ở TƯƠNG LAI:`
  );
  for (const h of badHistories) {
    console.log(
      `  - AssetHistory #${h.id} | asset ${h.asset.assetTag} (${h.asset.serialNumber}) | action=${h.action} | createdAt=${h.createdAt.toISOString()}`
    );
  }

  console.log("");
  console.log(
    `Tìm thấy ${badAssets.length} Asset có purchaseDate nằm ở TƯƠNG LAI:`
  );
  for (const a of badAssets) {
    console.log(
      `  - Asset #${a.id} ${a.assetTag} (${a.serialNumber}) | purchaseDate=${a.purchaseDate?.toISOString()}`
    );
  }

  if (badHistories.length === 0 && badAssets.length === 0) {
    console.log("");
    console.log("Không có gì cần sửa — dữ liệu đã sạch.");
    return;
  }

  if (!CONFIRM) {
    console.log("");
    console.log(
      "=> Đây là DRY-RUN, chưa sửa gì cả. Chạy lại kèm --confirm để sửa thật:"
    );
    console.log("   docker compose exec app npx tsx prisma/fix-future-history-dates.ts --confirm");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (badHistories.length > 0) {
      await tx.assetHistory.updateMany({
        where: { id: { in: badHistories.map((h) => h.id) } },
        data: { createdAt: now },
      });
    }

    if (badAssets.length > 0) {
      await tx.asset.updateMany({
        where: { id: { in: badAssets.map((a) => a.id) } },
        data: { purchaseDate: now },
      });
    }
  });

  console.log("");
  console.log(
    `Đã sửa xong: ${badHistories.length} AssetHistory + ${badAssets.length} Asset, tất cả đưa về createdAt/purchaseDate = ${now.toISOString()}.`
  );
}

main()
  .catch((error) => {
    console.error("LỖI:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
