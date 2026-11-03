/**
 * Sửa các thiết bị có Asset.currentEmployeeId vẫn còn trỏ tới 1 nhân viên dù
 * status KHÔNG PHẢI "Đã cấp phát" (VD: đã Trong kho, Đang bảo trì, Thanh
 * lý, Bị mất) — phát hiện khi trang Tài sản hiển thị nhầm tên người dùng
 * cho thiết bị đang ở trạng thái Trong kho (bấm vào thẻ "Màn hình" ở
 * Dashboard vẫn thấy 1 máy có tên nhân viên dù đang lọc status=IN_STOCK).
 *
 * Nguyên nhân nhiều khả năng: dữ liệu cũ từ trước khi các action Thu hồi
 * (returnAssetAction/bulkReturnAssetsAction) được vá để LUÔN xoá
 * currentEmployeeId cùng lúc đổi status — hoặc bị sửa tay trực tiếp trong
 * DB ở giai đoạn đầu triển khai.
 *
 * Script này KHÔNG đoán/khôi phục lịch sử bàn giao — chỉ đơn giản xoá
 * (set NULL) currentEmployeeId cho các thiết bị không còn ở trạng thái
 * ASSIGNED, để dữ liệu nhất quán với status hiện tại.
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG sửa gì cả):
 *        docker compose exec app npx tsx prisma/fix-stale-current-employee.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy sửa thật:
 *        docker compose exec app npx tsx prisma/fix-stale-current-employee.ts --confirm
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const badAssets = await prisma.asset.findMany({
    where: {
      status: { not: "ASSIGNED" },
      currentEmployeeId: { not: null },
    },
    include: {
      currentEmployee: { select: { fullName: true, employeeCode: true } },
    },
    orderBy: { assetTag: "asc" },
  });

  console.log(
    `Tìm thấy ${badAssets.length} thiết bị có currentEmployeeId còn sót dù status không phải ASSIGNED:`
  );
  for (const a of badAssets) {
    console.log(
      `  - Asset #${a.id} ${a.assetTag} (${a.serialNumber}) | status=${a.status} | currentEmployee=${a.currentEmployee?.fullName ?? "?"} (${a.currentEmployee?.employeeCode ?? "?"})`
    );
  }

  if (badAssets.length === 0) {
    console.log("");
    console.log("Không có gì cần sửa — dữ liệu đã sạch.");
    return;
  }

  if (!CONFIRM) {
    console.log("");
    console.log(
      "=> Đây là DRY-RUN, chưa sửa gì cả. Chạy lại kèm --confirm để sửa thật:"
    );
    console.log("   docker compose exec app npx tsx prisma/fix-stale-current-employee.ts --confirm");
    return;
  }

  const result = await prisma.asset.updateMany({
    where: {
      status: { not: "ASSIGNED" },
      currentEmployeeId: { not: null },
    },
    data: { currentEmployeeId: null },
  });

  console.log("");
  console.log(`Đã sửa xong: xoá currentEmployeeId của ${result.count} thiết bị.`);
}

main()
  .catch((error) => {
    console.error("LỖI:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
