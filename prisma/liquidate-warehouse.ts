/**
 * Chuyển HÀNG LOẠT toàn bộ thiết bị đang nằm trong kho "KTL-VTE-Kho Thanh
 * Lý" (hoặc kho khớp từ khoá tìm bên dưới) sang tình trạng "Chờ thanh lý"
 * (status=RETIRED, liquidatedAt để trống) — dùng khi cả 1 kho vật lý thực
 * chất là nơi chứa đồ chờ thanh lý, thay vì phải bấm tay từng máy 1 qua
 * modal "Gửi bảo hành / Hư hỏng / Thanh lý".
 *
 * CHỈ đụng tới thiết bị đang ở trạng thái "Trong kho" (IN_STOCK) — thiết bị
 * đang "Đã cấp phát" (ASSIGNED) cho ai đó sẽ bị BỎ QUA và liệt kê riêng,
 * vì phải thu hồi từ nhân viên trước (qua trang chi tiết thiết bị) mới
 * chuyển sang thanh lý được — script này không tự ý gỡ người đang giữ máy.
 * Thiết bị đã REPAIR/RETIRED/LOST từ trước cũng bị bỏ qua (không có gì để
 * làm thêm).
 *
 * KHÔNG đổi warehouseId của thiết bị — máy vẫn nằm nguyên đúng kho vật lý
 * đó, chỉ đổi status + ghi lịch sử để phần mềm phản ánh đúng thực tế.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG đổi gì cả):
 *        docker compose exec app npx tsx prisma/liquidate-warehouse.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy thật — BẮT BUỘC truyền tên người thực
 *      hiện (--by=) để log ghi đúng ai đã làm việc này:
 *        docker compose exec app npx tsx prisma/liquidate-warehouse.ts --confirm --by="Henry"
 *
 * Nếu kho của bạn không khớp từ khoá tìm mặc định bên dưới, sửa lại
 * WAREHOUSE_MATCH rồi chạy lại dry-run để kiểm tra đã tìm đúng kho chưa
 * trước khi thêm --confirm.
 */

import { PrismaClient, AssetStatus, HistoryAction } from "@prisma/client";

const prisma = new PrismaClient();

// Tìm kho theo code HOẶC name chứa 1 trong các từ khoá này (không phân biệt
// hoa/thường, không phân biệt dấu) — linh hoạt vì không rõ kho được đặt tên
// đúng "code - name" theo chuẩn hiển thị (VD "KTL - Kho Thanh Lý") hay gộp
// liền thành 1 chuỗi như "KTL-VTE-Kho Thanh Lý".
const WAREHOUSE_MATCH_KEYWORDS = ["KTL", "Thanh Lý", "Thanh Ly"];

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
    include: { region: true },
  });

  if (warehouses.length === 0) {
    console.log(
      `Không tìm thấy kho nào khớp từ khoá: ${WAREHOUSE_MATCH_KEYWORDS.join(", ")}.\n` +
        `Sửa lại WAREHOUSE_MATCH_KEYWORDS trong file này cho đúng tên/mã kho thật rồi chạy lại.`
    );
    return;
  }

  console.log(`Tìm thấy ${warehouses.length} kho khớp:`);
  for (const w of warehouses) {
    console.log(`  #${w.id}  ${w.code} - ${w.name}${w.region ? ` (Region: ${w.region.name})` : ""}`);
  }

  if (warehouses.length > 1) {
    console.log(
      `\n⚠ Khớp nhiều hơn 1 kho — kiểm tra kỹ danh sách trên có đúng CHỈ kho bạn muốn chuyển không. ` +
        `Nếu không đúng, thu hẹp lại WAREHOUSE_MATCH_KEYWORDS rồi chạy lại dry-run.`
    );
  }

  const warehouseIds = warehouses.map((w) => w.id);
  const warehouseLabelById = new Map(
    warehouses.map((w) => [w.id, `${w.code} - ${w.name}`])
  );

  const assets = await prisma.asset.findMany({
    where: { warehouseId: { in: warehouseIds } },
    include: { model: true, currentEmployee: true },
  });

  const toLiquidate = assets.filter((a) => a.status === AssetStatus.IN_STOCK);
  const assigned = assets.filter((a) => a.status === AssetStatus.ASSIGNED);
  const alreadyOther = assets.filter(
    (a) => a.status !== AssetStatus.IN_STOCK && a.status !== AssetStatus.ASSIGNED
  );

  console.log(`\nTổng thiết bị trong kho: ${assets.length}`);
  console.log(`  → Trong kho (sẽ chuyển sang Chờ thanh lý): ${toLiquidate.length}`);
  console.log(`  → Đã cấp phát (BỎ QUA — cần thu hồi thủ công trước): ${assigned.length}`);
  console.log(`  → Đã ở trạng thái khác (Bảo trì/Chờ thanh lý/Mất — bỏ qua): ${alreadyOther.length}`);

  if (assigned.length > 0) {
    console.log(`\n⚠ Các thiết bị đang Đã cấp phát, KHÔNG bị đụng tới:`);
    for (const a of assigned) {
      console.log(
        `   ${a.assetTag} — ${a.model.brand} ${a.model.modelName} (SN: ${a.serialNumber}) — đang giữ bởi: ${a.currentEmployee?.fullName ?? "?"}`
      );
    }
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

  if (toLiquidate.length === 0) {
    console.log(`\nKhông có thiết bị nào (đang Trong kho) để chuyển — không cần làm gì thêm.`);
    return;
  }

  console.log(`\nĐang chuyển ${toLiquidate.length} thiết bị sang Chờ thanh lý (thực hiện bởi: ${actorName})...`);

  for (const asset of toLiquidate) {
    await prisma.$transaction([
      prisma.asset.update({
        where: { id: asset.id },
        data: {
          status: AssetStatus.RETIRED,
          condition: `Chờ thanh lý: chuyển hàng loạt từ kho ${
            warehouseLabelById.get(asset.warehouseId ?? -1) ?? asset.warehouseId
          }`,
        },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.RETIRE,
          fromWarehouseId: asset.warehouseId,
          toWarehouseId: asset.warehouseId,
          note: `Chờ thanh lý — chuyển hàng loạt cả kho (script liquidate-warehouse.ts) — SN: ${asset.serialNumber}`,
          createdBy: actorName,
        },
      }),
    ]);
  }

  console.log(`\n=== HOÀN TẤT — đã chuyển ${toLiquidate.length} thiết bị sang Chờ thanh lý ===`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
