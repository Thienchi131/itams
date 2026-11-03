/**
 * Script CHỈ ĐỌC (không đổi/xoá gì) — điều tra sự cố ngày 02/08/2026: import
 * Excel hôm đó tạo ra 1 kho MỚI trùng lặp tên "KTL - KTL" (vì cột "Kho"
 * trong file vẫn ghi chữ "KTL" — tên cũ trước khi kho thanh lý vật lý được
 * gộp về "LAO"/"LSA" ngày 30/07 — nên hệ thống không khớp được kho nào có
 * sẵn, tự tạo kho mới), đồng thời do import UPDATE thẳng (không có điều kiện
 * bảo vệ) lên các thiết bị đã có sẵn theo Serial Number trùng khớp:
 *   - warehouseId  bị đổi sang kho "KTL - KTL" mới tạo này
 *   - status       bị tính lại từ cột "Trạng Thái" trong file qua mapStatus()
 *                  — hàm này KHÔNG có nhánh cho "Chờ thanh lý"/RETIRED, và vì
 *                  chữ "Kho Thanh Lý" có chứa từ "kho" nên bị match nhầm vào
 *                  IN_STOCK (Trong kho) thay vì giữ nguyên RETIRED.
 * Hậu quả: toàn bộ thiết bị đang "Chờ thanh lý" (trang Kho thanh lý) bị coi
 * như "Trong kho" trở lại và bị chuyển sang kho trùng lặp mới này — trang
 * Kho thanh lý hiển thị 0/0.
 *
 * Script này liệt kê chi tiết để XÁC NHẬN đúng phạm vi trước khi chạy script
 * sửa (fix-ktl-import-incident.ts).
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   docker compose exec app npx tsx prisma/inspect-ktl-import-incident.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MATCH_KEYWORDS = ["KTL", "VTE", "Thanh Lý", "Thanh Ly", "LAO", "LSA", "Laos"];

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    where: {
      OR: MATCH_KEYWORDS.flatMap((kw) => [
        { code: { contains: kw, mode: "insensitive" as const } },
        { name: { contains: kw, mode: "insensitive" as const } },
      ]),
    },
    include: { region: true },
    orderBy: { id: "asc" },
  });

  if (warehouses.length === 0) {
    console.log(`Không tìm thấy kho nào khớp từ khoá: ${MATCH_KEYWORDS.join(", ")}.`);
    return;
  }

  console.log(`=== Danh sách kho liên quan (${warehouses.length}) ===\n`);

  for (const w of warehouses) {
    const [total, byStatus] = await Promise.all([
      prisma.asset.count({ where: { warehouseId: w.id } }),
      prisma.asset.groupBy({
        by: ["status"],
        where: { warehouseId: w.id },
        _count: true,
      }),
    ]);

    console.log(`#${w.id}  ${w.code} - ${w.name}${w.region ? `  (Region: ${w.region.name})` : "  (Region: —)"}`);
    console.log(`   Tổng thiết bị: ${total}`);
    for (const row of byStatus) {
      console.log(`     ${row.status}: ${row._count}`);
    }
    console.log("");
  }

  const ktl = warehouses.find((w) => w.code.toUpperCase() === "KTL");
  if (ktl) {
    console.log(`=== Chi tiết thiết bị trong kho trùng lặp "#${ktl.id} ${ktl.code} - ${ktl.name}" ===\n`);

    const assets = await prisma.asset.findMany({
      where: { warehouseId: ktl.id },
      include: { model: true, currentEmployee: true },
      orderBy: { id: "asc" },
    });

    for (const a of assets) {
      console.log(
        `   ${a.assetTag}  SN:${a.serialNumber}  ${a.model.brand} ${a.model.modelName}  ` +
          `status=${a.status}  liquidatedAt=${a.liquidatedAt ? a.liquidatedAt.toISOString() : "—"}  ` +
          `currentEmployee=${a.currentEmployee?.fullName ?? "—"}`
      );
    }

    console.log(`\nTổng cộng: ${assets.length} thiết bị trong kho "${ktl.code} - ${ktl.name}".`);
    console.log(
      `   → ${assets.filter((a) => a.status !== "RETIRED" && a.status !== "ASSIGNED").length} thiết bị SẼ được khôi phục về "Chờ thanh lý" (RETIRE) khi chạy script sửa.`
    );
    console.log(
      `   → ${assets.filter((a) => a.status === "ASSIGNED").length} thiết bị đang "Đã cấp phát" — script sửa sẽ BỎ QUA, không đụng tới (cần xử lý tay nếu sai).`
    );
    console.log(
      `   → ${assets.filter((a) => a.status === "RETIRED").length} thiết bị đã sẵn RETIRED trong kho này — script sửa chỉ chuyển kho, không đổi status.`
    );
  }

  console.log(`\nĐây là dữ liệu THẬT trong DB — không có gì bị xoá/đổi bởi script này.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
