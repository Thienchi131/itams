/**
 * Sửa sự cố import Excel ngày 02/08/2026 — xem giải thích đầy đủ nguyên nhân
 * trong inspect-ktl-import-incident.ts. Tóm tắt: import hôm đó vô tình
 * chuyển toàn bộ thiết bị đang "Chờ thanh lý" (status=RETIRED) trở lại
 * "Trong kho" (IN_STOCK) VÀ dồn hết sang 1 kho mới trùng lặp "KTL - KTL"
 * (thay vì kho thật hiện đang dùng, "LAO"/"LSA" - Laos).
 *
 * Script này, với TỪNG thiết bị đang nằm trong kho "KTL" (kho mới trùng lặp
 * do import tạo ra):
 *   - Nếu đang KHÔNG phải "Đã cấp phát" (ASSIGNED): đưa status về lại
 *     RETIRED (Chờ thanh lý) + chuyển warehouseId về kho LAO/LSA (kho thật
 *     đang dùng chung cho thiết bị chờ/đã thanh lý) + ghi lịch sử RETIRE.
 *   - Nếu đang "Đã cấp phát" (ASSIGNED): BỎ QUA hoàn toàn, không đụng tới —
 *     liệt kê riêng để tự kiểm tra tay (rất khó xảy ra với lô này, nhưng an
 *     toàn vẫn hơn).
 *
 * KHÔNG đổi liquidatedAt/liquidatedBy — 2 field này KHÔNG hề bị import hôm
 * đó đụng tới (import chỉ ghi đè modelId/condition/status/warehouseId/
 * purchaseDate/note), nên nếu thiết bị nào trước đó đã "Đã thanh lý" thật sự
 * (liquidatedAt có giá trị), dữ liệu đó vẫn còn nguyên và KHÔNG bị script
 * này đổi — chỉ set lại status=RETIRED là đủ để trang Kho thanh lý hiển thị
 * đúng lại (Chờ/Đã thanh lý tính theo liquidatedAt có/không có giá trị).
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Chạy inspect-ktl-import-incident.ts trước để xem đúng phạm vi.
 *   2. Dry-run (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/fix-ktl-import-incident.ts
 *   3. Xem báo cáo ổn rồi mới chạy thật — BẮT BUỘC truyền tên người thực
 *      hiện (--by=) để log ghi đúng ai đã làm việc này:
 *        docker compose exec app npx tsx prisma/fix-ktl-import-incident.ts --confirm --by="Henry"
 *   4. Sau khi chạy xong, xác nhận kho "KTL - KTL" còn 0 thiết bị, rồi vào
 *      Cài đặt > Quản lý kho để xoá kho đó (UI tự chặn nếu còn sót gì).
 */

import { PrismaClient, AssetStatus, HistoryAction } from "@prisma/client";

const prisma = new PrismaClient();

// Kho mới trùng lặp do import tạo ra — khớp CHÍNH XÁC mã "KTL" (không dùng
// contains, để không lỡ khớp nhầm kho khác có chữ KTL trong tên).
const SOURCE_EXACT_CODE = "KTL";

// Kho thật đang dùng chung cho thiết bị chờ/đã thanh lý. Hệ thống có CẢ 2
// kho "LAO - Lao" (#112, đang có 1864 thiết bị — đây là kho THẬT đang dùng,
// khớp đúng với kho đích của lần gộp trước ngày 30/07) VÀ "LSA - Laos"
// (#128, kho cũ từ seed ban đầu, không còn dùng) — chỉ định đích danh "LAO"
// để không bị nhầm.
const TARGET_EXACT_CODE_CANDIDATES = ["LAO"];

const CONFIRM = process.argv.includes("--confirm");
const byArg = process.argv.find((a) => a.startsWith("--by="));
const actorName = byArg ? byArg.slice("--by=".length).trim() : "";

async function main() {
  const source = await prisma.warehouse.findFirst({
    where: { code: { equals: SOURCE_EXACT_CODE, mode: "insensitive" as const } },
    include: { region: true },
  });

  if (!source) {
    console.log(`Không tìm thấy kho nguồn với mã "${SOURCE_EXACT_CODE}" — không có gì để sửa (có thể đã dọn rồi).`);
    return;
  }

  const targets = await prisma.warehouse.findMany({
    where: {
      OR: TARGET_EXACT_CODE_CANDIDATES.map((code) => ({
        code: { equals: code, mode: "insensitive" as const },
      })),
    },
    include: { region: true },
  });

  if (targets.length !== 1) {
    console.log(
      `Khớp ${targets.length} kho ĐÍCH với mã [${TARGET_EXACT_CODE_CANDIDATES.join(", ")}] — cần khớp ĐÚNG 1 kho.`
    );
    targets.forEach((w) => console.log(`   #${w.id}  ${w.code} - ${w.name}`));
    console.log(`Sửa lại TARGET_EXACT_CODE_CANDIDATES trong file này cho đúng rồi chạy lại.`);
    return;
  }

  const target = targets[0];

  if (source.id === target.id) {
    console.log(`Kho nguồn và kho đích đang trùng nhau (#${source.id}) — dừng lại.`);
    return;
  }

  console.log(`Kho NGUỒN (trùng lặp, sẽ dọn trống): #${source.id}  ${source.code} - ${source.name}${source.region ? ` (Region: ${source.region.name})` : ""}`);
  console.log(`Kho ĐÍCH (nơi thiết bị Chờ/Đã thanh lý thật sự nằm): #${target.id}  ${target.code} - ${target.name}${target.region ? ` (Region: ${target.region.name})` : ""}`);

  const assets = await prisma.asset.findMany({
    where: { warehouseId: source.id },
    include: { model: true, currentEmployee: true },
    orderBy: { id: "asc" },
  });

  const toRestore = assets.filter((a) => a.status !== AssetStatus.ASSIGNED && a.status !== AssetStatus.RETIRED);
  const alreadyRetired = assets.filter((a) => a.status === AssetStatus.RETIRED);
  const assigned = assets.filter((a) => a.status === AssetStatus.ASSIGNED);

  console.log(`\nTổng thiết bị trong kho nguồn: ${assets.length}`);
  console.log(`  → Sẽ khôi phục về "Chờ thanh lý" (RETIRE) + chuyển kho: ${toRestore.length}`);
  console.log(`  → Đã sẵn RETIRED — chỉ chuyển kho, không đổi status: ${alreadyRetired.length}`);
  console.log(`  → Đang "Đã cấp phát" — BỎ QUA hoàn toàn: ${assigned.length}`);

  if (assigned.length > 0) {
    console.log(`\n⚠ Các thiết bị đang Đã cấp phát, KHÔNG bị đụng tới:`);
    for (const a of assigned) {
      console.log(
        `   ${a.assetTag} — ${a.model.brand} ${a.model.modelName} (SN: ${a.serialNumber}) — đang giữ bởi: ${a.currentEmployee?.fullName ?? "?"}`
      );
    }
  }

  if (assets.length === 0) {
    console.log(`\nKho nguồn đã trống — không có gì để sửa. Có thể xoá kho "${source.code} - ${source.name}" qua Cài đặt > Quản lý kho ngay.`);
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

  console.log(`\nĐang sửa ${toRestore.length + alreadyRetired.length} thiết bị (thực hiện bởi: ${actorName})...`);

  for (const asset of toRestore) {
    await prisma.$transaction([
      prisma.asset.update({
        where: { id: asset.id },
        data: { status: AssetStatus.RETIRED, warehouseId: target.id },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.RETIRE,
          fromWarehouseId: source.id,
          toWarehouseId: target.id,
          note: `Khôi phục sau sự cố import Excel 02/08/2026 (script fix-ktl-import-incident.ts) — thiết bị bị nhầm đưa về "Trong kho" và dồn sang kho trùng lặp "${source.code}", nay khôi phục lại "Chờ thanh lý" — SN: ${asset.serialNumber}`,
          createdBy: actorName,
        },
      }),
    ]);
  }

  for (const asset of alreadyRetired) {
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
          note: `Dọn kho trùng lặp sau sự cố import Excel 02/08/2026 (script fix-ktl-import-incident.ts) — SN: ${asset.serialNumber}`,
          createdBy: actorName,
        },
      }),
    ]);
  }

  console.log(`\n=== HOÀN TẤT — đã khôi phục/chuyển ${toRestore.length + alreadyRetired.length} thiết bị về kho "${target.code} - ${target.name}" ===`);
  console.log(`Vào Cài đặt > Quản lý kho để xoá kho "${source.code} - ${source.name}" (giờ đã trống, trừ khi còn thiết bị "Đã cấp phát" bị bỏ qua ở trên).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
