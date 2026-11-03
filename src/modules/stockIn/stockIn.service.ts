import { prisma } from "@/lib/prisma";
import { AssetStatus } from "@prisma/client";

// Danh sách phiếu nhập — gộp cả phiếu tạo tay qua form "Nhập kho" (slipNo bắt
// đầu "PN-") lẫn phiếu do Import Excel tạo ra (slipNo bắt đầu "IMPORT-"), vì
// cả 2 đường đều ghi ra cùng 1 bảng StockInSlip, chỉ khác slipNo/note.
//
// LƯU Ý: cột StockInSlip.warehouseId KHÔNG đáng tin — 1 phiếu (đặc biệt phiếu
// Import Excel) có thể gồm nhiều thiết bị thuộc nhiều kho thật khác nhau, nên
// KHÔNG dùng warehouseId của phiếu để hiển thị. Kho hiển thị được suy ra từ
// kho THẬT của từng Asset trong phiếu (Asset.warehouse, có quan hệ Prisma
// thật, khác với StockInSlip chỉ có warehouseId dạng số).
export async function getStockInSlips() {
  const slips = await prisma.stockInSlip.findMany({
    include: {
      items: { include: { asset: { include: { warehouse: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return slips.map((slip) => {
    const warehouseByCode = new Map(
      slip.items
        .map((item) => item.asset.warehouse)
        .filter((w): w is NonNullable<typeof w> => w !== null)
        .map((w) => [w.code, w])
    );
    const warehouses = [...warehouseByCode.values()];

    return {
      ...slip,
      itemCount: slip.items.length,
      // Danh sách kho THẬT (suy từ asset), có thể rỗng/1/nhiều kho.
      warehouses,
      source: slip.slipNo.startsWith("IMPORT-")
        ? ("import" as const)
        : ("manual" as const),
    };
  });
}

export async function getStockInSlipById(id: number) {
  const slip = await prisma.stockInSlip.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          asset: {
            include: {
              model: true,
              currentEmployee: true,
              warehouse: true,
            },
          },
        },
      },
    },
  });

  if (!slip) return null;

  const warehouseByCode = new Map(
    slip.items
      .map((item) => item.asset.warehouse)
      .filter((w): w is NonNullable<typeof w> => w !== null)
      .map((w) => [w.code, w])
  );
  const warehouses = [...warehouseByCode.values()];

  return { ...slip, warehouses };
}

/**
 * 1 asset được coi là "còn nguyên trạng lúc mới nhập" (an toàn để xoá cùng
 * phiếu) nếu: vẫn đang CÒN TRONG KHO, chưa từng được cấp phát cho ai, và
 * không có lịch sử nào khác ngoài đúng dòng "Nhập kho" ban đầu (không bị
 * chuyển kho/sửa chữa/xuất kho...). Bất kỳ thay đổi nào kể trên đều coi là
 * đã "động" tới thiết bị — chặn xoá để tránh mất dữ liệu thiết bị đang dùng
 * thật, bắt Admin tự xử lý (thu hồi/chuyển kho) trước rồi xoá lại.
 */
export async function checkSlipDeletable(slipId: number) {
  const slip = await prisma.stockInSlip.findUnique({
    where: { id: slipId },
    include: {
      items: {
        include: { asset: true },
      },
    },
  });

  if (!slip) {
    return { slip: null, blockedAssets: [], deletableAssetIds: [] as number[] };
  }

  const assetIds = slip.items.map((item) => item.assetId);

  const [historyCounts, stockOutCounts] = await Promise.all([
    prisma.assetHistory.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { assetId: true },
    }),
    prisma.stockOutItem.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { assetId: true },
    }),
  ]);

  const historyCountByAsset = new Map(
    historyCounts.map((row) => [row.assetId, row._count.assetId])
  );
  const stockOutCountByAsset = new Map(
    stockOutCounts.map((row) => [row.assetId, row._count.assetId])
  );

  const blockedAssets: {
    id: number;
    assetTag: string;
    serialNumber: string;
    reason: string;
  }[] = [];
  const deletableAssetIds: number[] = [];

  for (const item of slip.items) {
    const asset = item.asset;
    const historyCount = historyCountByAsset.get(asset.id) ?? 0;
    const stockOutCount = stockOutCountByAsset.get(asset.id) ?? 0;

    const reasons: string[] = [];

    if (asset.status !== AssetStatus.IN_STOCK) {
      reasons.push(`trạng thái hiện tại là "${asset.status}"`);
    }

    if (asset.currentEmployeeId) {
      reasons.push("đang được cấp phát cho 1 nhân viên");
    }

    if (stockOutCount > 0) {
      reasons.push("đã có phiếu xuất kho");
    }

    // > 1 vì luôn có sẵn đúng 1 dòng lịch sử "Nhập kho" ghi lúc tạo phiếu.
    if (historyCount > 1) {
      reasons.push("đã có thêm lịch sử thay đổi sau khi nhập");
    }

    if (reasons.length > 0) {
      blockedAssets.push({
        id: asset.id,
        assetTag: asset.assetTag,
        serialNumber: asset.serialNumber,
        reason: reasons.join(", "),
      });
    } else {
      deletableAssetIds.push(asset.id);
    }
  }

  return { slip, blockedAssets, deletableAssetIds };
}
