/**
 * Chuyển HÀNG LOẠT toàn bộ thiết bị từ 1 kho nguồn sang 1 kho đích — dùng
 * lúc này để dọn kho "KTL - VTE - Kho Thanh Lý" (đã có tính năng Kho thanh
 * lý riêng theo status, không cần giữ 1 kho vật lý tên trùng ý nghĩa nữa)
 * bằng cách gom hết 238 thiết bị RETIRED trong đó về kho Laos chung (LSA),
 * sau đó xoá kho KTL rỗng qua Cài đặt > Quản lý kho như bình thường.
 *
 * CHỈ đổi warehouseId — KHÔNG đổi status/liquidatedAt/currentEmployeeId của
 * thiết bị, vì mục đích chỉ là dọn kho vật lý dư thừa, thiết bị vẫn đang
 * "Chờ thanh lý" y nguyên.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/move-warehouse-assets.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy thật — BẮT BUỘC truyền tên người thực
 *      hiện (--by=) để log ghi đúng ai đã làm việc này:
 *        docker compose exec app npx tsx prisma/move-warehouse-assets.ts --confirm --by="Henry"
 *
 * Sau khi chạy xong và xác nhận kho nguồn còn 0 thiết bị, vào Cài đặt >
 * Quản lý kho để xoá kho nguồn (UI đã tự chặn nếu còn sót asset/supply/user
 * nào tham chiếu tới, nên xoá qua đó an toàn, không cần script riêng).
 */

import { PrismaClient, HistoryAction } from "@prisma/client";

const prisma = new PrismaClient();

// Sửa lại nếu cần dùng script cho tình huống khác — chỉ cần khớp DUY NHẤT 1
// kho nguồn và DUY NHẤT 1 kho đích để tránh chuyển nhầm. Kho đích dùng khớp
// ĐÚNG mã (code), không dùng contains theo tên như kho nguồn — vì có tới 2
// kho tên gần giống nhau ("LAO - Lao" và "LSA - Laos"), contains theo "Lao"
// sẽ khớp cả 2 nên phải chỉ đích danh đúng mã kho cần.
const SOURCE_MATCH_KEYWORDS = ["KTL", "Thanh Lý", "Thanh Ly"];
const TARGET_EXACT_CODE = "LAO";

const CONFIRM = process.argv.includes("--confirm");
const byArg = process.argv.find((a) => a.startsWith("--by="));
const actorName = byArg ? byArg.slice("--by=".length).trim() : "";

async function findWarehouse(keywords: string[]) {
  return prisma.warehouse.findMany({
    where: {
      OR: keywords.flatMap((kw) => [
        { code: { contains: kw, mode: "insensitive" as const } },
        { name: { contains: kw, mode: "insensitive" as const } },
      ]),
    },
    include: { region: true },
  });
}

async function main() {
  const sources = await findWarehouse(SOURCE_MATCH_KEYWORDS);
  const target = await prisma.warehouse.findFirst({
    where: { code: { equals: TARGET_EXACT_CODE, mode: "insensitive" as const } },
    include: { region: true },
  });

  if (sources.length !== 1) {
    console.log(
      `Khớp ${sources.length} kho NGUỒN với từ khoá [${SOURCE_MATCH_KEYWORDS.join(", ")}] — cần khớp ĐÚNG 1 kho. Sửa lại SOURCE_MATCH_KEYWORDS rồi chạy lại.`
    );
    sources.forEach((w) => console.log(`   #${w.id}  ${w.code} - ${w.name}`));
    return;
  }

  if (!target) {
    console.log(`Không tìm thấy kho ĐÍCH với mã "${TARGET_EXACT_CODE}" — sửa lại TARGET_EXACT_CODE rồi chạy lại.`);
    return;
  }

  const source = sources[0];

  if (source.id === target.id) {
    console.log(`Kho nguồn và kho đích đang trùng nhau (#${source.id}) — dừng lại, không có gì để chuyển.`);
    return;
  }

  console.log(`Kho NGUỒN: #${source.id}  ${source.code} - ${source.name}${source.region ? ` (Region: ${source.region.name})` : ""}`);
  console.log(`Kho ĐÍCH:  #${target.id}  ${target.code} - ${target.name}${target.region ? ` (Region: ${target.region.name})` : ""}`);

  const assets = await prisma.asset.findMany({ where: { warehouseId: source.id } });

  console.log(`\nSố thiết bị sẽ chuyển: ${assets.length}`);

  if (assets.length === 0) {
    console.log(`Kho nguồn đã trống — không có gì để chuyển. Có thể xoá kho nguồn qua Cài đặt > Quản lý kho ngay.`);
    return;
  }

  if (!CONFIRM) {
    console.log(
      `\n(Đây là DRY-RUN — chưa đổi gì cả. Chạy lại với "--confirm --by=\"Tên bạn\"" để thực hiện thật.)`
    );
    return;
  }

  if (!actorName) {
    console.log(
      `\nDừng lại — cần truyền tên người thực hiện qua --by="Tên bạn" để ghi đúng vào log lịch sử.`
    );
    return;
  }

  console.log(`\nĐang chuyển ${assets.length} thiết bị từ "${source.code}" sang "${target.code}" (thực hiện bởi: ${actorName})...`);

  for (const asset of assets) {
    await prisma.$transaction([
      prisma.asset.update({
        where: { id: asset.id },
        data: { warehouseId: target.id },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.WAREHOUSE_TRANSFER,
          fromWarehouseId: source.id,
          toWarehouseId: target.id,
          note: `Chuyển hàng loạt (script move-warehouse-assets.ts) — dọn kho "${source.code} - ${source.name}" — SN: ${asset.serialNumber}`,
          createdBy: actorName,
        },
      }),
    ]);
  }

  console.log(`\n=== HOÀN TẤT — đã chuyển ${assets.length} thiết bị sang "${target.code} - ${target.name}" ===`);
  console.log(`Vào Cài đặt > Quản lý kho để xoá kho "${source.code} - ${source.name}" (giờ đã trống).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
