/**
 * Debug: in ra chi tiết 1 thiết bị + toàn bộ lịch sử (AssetHistory) của nó,
 * kèm warehouseId/employeeId thô (không qua UI) để xác định vì sao cột
 * "Từ"/"Đến" ở Bàn giao/Thu hồi không hiện được tên kho.
 *
 * Cách chạy (trong container):
 *   docker compose exec app sh -c \
 *     "ASSET_TAG=IT-150726-xxxxxxx npx tsx prisma/debug-asset-history.ts"
 *   # hoặc tìm theo serial:
 *   docker compose exec app sh -c \
 *     "SERIAL=abcxyz npx tsx prisma/debug-asset-history.ts"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ASSET_TAG = (process.env.ASSET_TAG || "").trim();
const SERIAL = (process.env.SERIAL || "").trim();

async function main() {
  if (!ASSET_TAG && !SERIAL) {
    console.error(
      "\nThiếu tham số. Ví dụ:\n" +
        "  ASSET_TAG=IT-150726-xxxxxxx npx tsx prisma/debug-asset-history.ts\n" +
        "  SERIAL=abcxyz npx tsx prisma/debug-asset-history.ts\n"
    );
    process.exit(1);
  }

  const asset = await prisma.asset.findFirst({
    where: ASSET_TAG
      ? { assetTag: ASSET_TAG }
      : { serialNumber: { equals: SERIAL, mode: "insensitive" } },
    include: {
      warehouse: true,
      currentEmployee: true,
      histories: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) {
    console.error("Không tìm thấy thiết bị.");
    process.exit(1);
  }

  console.log("\n=== ASSET ===");
  console.log(`id: ${asset.id}`);
  console.log(`assetTag: ${asset.assetTag}`);
  console.log(`serialNumber: ${asset.serialNumber}`);
  console.log(`status: ${asset.status}`);
  console.log(`warehouseId: ${asset.warehouseId}`);
  console.log(
    `warehouse: ${asset.warehouse ? `${asset.warehouse.code} - ${asset.warehouse.name}` : "NULL"}`
  );
  console.log(`currentEmployeeId: ${asset.currentEmployeeId}`);
  console.log(`currentEmployee: ${asset.currentEmployee?.fullName ?? "NULL"}`);

  console.log("\n=== HISTORIES (mới nhất trước) ===");
  for (const h of asset.histories) {
    console.log(
      `[${h.createdAt.toISOString()}] action=${h.action} ` +
        `fromWarehouseId=${h.fromWarehouseId} toWarehouseId=${h.toWarehouseId} ` +
        `fromEmployeeId=${h.fromEmployeeId} toEmployeeId=${h.toEmployeeId} ` +
        `createdBy=${h.createdBy}`
    );
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
