/**
 * Xoá đúng phần dữ liệu do tính năng Import Excel tạo ra — không đụng tới
 * Warehouse, User, hay bất kỳ data nào có từ trước lần import.
 *
 * Nhận diện dữ liệu cần xoá qua các phiếu nhập kho mà action import luôn tạo
 * ra với slipNo bắt đầu bằng "IMPORT-" (cả bản cũ "IMPORT-<ts>" lẫn bản mới
 * "IMPORT-NEW-<ts>" / "IMPORT-RETURNED-<ts>"):
 *   - Asset (+ StockInItem, AssetHistory, AssetAccessory, ...) gắn với các
 *     phiếu đó — NHƯNG chỉ xoá nếu asset đó THỰC SỰ do lần import tạo mới
 *     (createdAt gần với lúc phiếu được tạo). Asset đã có sẵn từ trước, bị
 *     import "đè" dữ liệu lên (trùng serial number) sẽ được GIỮ LẠI và liệt
 *     kê ra để tự kiểm tra tay — script không có bản ghi giá trị cũ nên
 *     không thể tự khôi phục.
 *   - AssetModel không còn Asset nào khác tham chiếu sau khi xoá (tức là
 *     model chỉ được tạo ra bởi chính lần import này)
 *   - Employee có employeeCode bắt đầu "PENDING-" (nhân viên được tự động
 *     tạo trong lúc import) VÀ không còn được tham chiếu ở bất kỳ đâu khác
 *     sau khi đã xoá xong asset ở trên
 *
 * CÁCH CHẠY (trong container trên VPS):
 *   1. Dry-run trước để xem báo cáo (KHÔNG xoá gì cả):
 *        docker compose exec app npx tsx prisma/undo-dxb-import.ts
 *
 *   2. Xem báo cáo ổn rồi mới chạy xoá thật:
 *        docker compose exec app npx tsx prisma/undo-dxb-import.ts --confirm
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRM = process.argv.includes("--confirm");

// Asset được coi là "do lần import này tạo ra" nếu createdAt của nó không
// sớm hơn quá 60 giây so với lúc phiếu StockInSlip liên quan được tạo (toàn
// bộ vòng lặp tạo asset chạy liền trong 1 lần gọi action, không mất quá 60s
// kể cả file lớn). Asset có từ trước lần import đó chắc chắn createdAt sớm
// hơn nhiều so với mốc này.
const CREATE_WINDOW_MS = 60_000;

async function main() {
  const slips = await prisma.stockInSlip.findMany({
    where: { slipNo: { startsWith: "IMPORT-" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  if (slips.length === 0) {
    console.log(
      "Không tìm thấy phiếu nhập nào từ Excel import (slipNo bắt đầu bằng IMPORT-) — có thể đã xoá rồi, hoặc chưa import lần nào."
    );
    return;
  }

  console.log(`Tìm thấy ${slips.length} phiếu nhập do Import Excel tạo ra:`);
  for (const slip of slips) {
    console.log(`  - ${slip.slipNo}  (tạo lúc ${slip.createdAt.toISOString()}, ${slip.items.length} dòng)`);
  }

  const assetIds = [
    ...new Set(slips.flatMap((slip) => slip.items.map((item) => item.assetId))),
  ];

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
  });

  // Với mỗi asset, tìm mốc thời gian sớm nhất trong các phiếu import có nhắc
  // tới nó, rồi so sánh với createdAt thật của asset.
  const earliestSlipTimeByAsset = new Map<number, Date>();
  for (const slip of slips) {
    for (const item of slip.items) {
      const current = earliestSlipTimeByAsset.get(item.assetId);
      if (!current || slip.createdAt < current) {
        earliestSlipTimeByAsset.set(item.assetId, slip.createdAt);
      }
    }
  }

  const deletableAssetIds: number[] = [];
  const preExisting: { id: number; assetTag: string; serialNumber: string }[] = [];

  for (const asset of assets) {
    const slipTime = earliestSlipTimeByAsset.get(asset.id);
    const diffMs = slipTime ? asset.createdAt.getTime() - slipTime.getTime() : 0;

    if (diffMs > -CREATE_WINDOW_MS) {
      deletableAssetIds.push(asset.id);
    } else {
      preExisting.push({ id: asset.id, assetTag: asset.assetTag, serialNumber: asset.serialNumber });
    }
  }

  console.log(`\nTổng số asset liên quan: ${assets.length}`);
  console.log(`  - Do import tạo mới (đủ điều kiện XOÁ): ${deletableAssetIds.length}`);
  console.log(`  - Đã tồn tại từ trước, import chỉ update (SẼ GIỮ LẠI): ${preExisting.length}`);

  if (preExisting.length > 0) {
    console.log(`\n  Asset có từ trước bị import "đè" dữ liệu lên (tự kiểm tra lại thủ công):`);
    for (const a of preExisting) {
      console.log(`    - #${a.id}  Tag: ${a.assetTag}  Serial: ${a.serialNumber}`);
    }
  }

  if (!CONFIRM) {
    console.log(`\n(Đây là DRY-RUN — chưa xoá gì cả. Chạy lại với "--confirm" để xoá thật.)`);
    return;
  }

  if (deletableAssetIds.length === 0) {
    console.log("\nKhông có asset nào đủ điều kiện xoá. Dừng lại.");
    return;
  }

  console.log(`\nĐang xoá ${deletableAssetIds.length} asset (và toàn bộ dữ liệu liên quan)...`);

  await prisma.$transaction(async (tx) => {
    const modelIds = [
      ...new Set(assets.filter((a) => deletableAssetIds.includes(a.id)).map((a) => a.modelId)),
    ];

    const relatedEmployeeIds = new Set<number>();
    const histories = await tx.assetHistory.findMany({
      where: { assetId: { in: deletableAssetIds } },
      select: { fromEmployeeId: true, toEmployeeId: true },
    });
    for (const h of histories) {
      if (h.fromEmployeeId) relatedEmployeeIds.add(h.fromEmployeeId);
      if (h.toEmployeeId) relatedEmployeeIds.add(h.toEmployeeId);
    }
    for (const a of assets) {
      if (deletableAssetIds.includes(a.id) && a.currentEmployeeId) {
        relatedEmployeeIds.add(a.currentEmployeeId);
      }
    }

    // Dọn hết mọi bảng tham chiếu tới Asset trước khi xoá Asset (tránh lỗi
    // khoá ngoại P2003 làm chạy dở dang).
    await tx.assetAccessory.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
    await tx.assetWarranty.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
    await tx.assetAssignment.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
    await tx.stockOutItem.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
    await tx.assetHistory.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
    await tx.stockInItem.deleteMany({ where: { assetId: { in: deletableAssetIds } } });

    const deletedAssets = await tx.asset.deleteMany({ where: { id: { in: deletableAssetIds } } });

    // Xoá phiếu nào không còn StockInItem nào tham chiếu (nghĩa là toàn bộ
    // asset trong phiếu đó đều đã bị xoá).
    let deletedSlipCount = 0;
    for (const slip of slips) {
      const remaining = await tx.stockInItem.count({ where: { stockInSlipId: slip.id } });
      if (remaining > 0) continue;
      await tx.stockInSlip.delete({ where: { id: slip.id } });
      deletedSlipCount++;
    }

    // Chỉ xoá model nào KHÔNG còn Asset nào khác (kể cả asset giữ lại ở
    // trên) tham chiếu.
    const stillUsed = await tx.asset.findMany({
      where: { modelId: { in: modelIds } },
      select: { modelId: true },
      distinct: ["modelId"],
    });
    const stillUsedIds = new Set(stillUsed.map((row) => row.modelId));
    const modelIdsToDelete = modelIds.filter((id) => !stillUsedIds.has(id));
    const deletedModels = await tx.assetModel.deleteMany({ where: { id: { in: modelIdsToDelete } } });

    // Chỉ xoá Employee dạng PENDING- (do import tự sinh) và không còn được
    // tham chiếu ở đâu khác sau khi đã xoá xong asset ở trên.
    let deletedEmployeeCount = 0;
    for (const employeeId of relatedEmployeeIds) {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee || !employee.employeeCode.startsWith("PENDING-")) continue;

      const [stillHasAssets, stillHasHistory, stillHasAssignment] = await Promise.all([
        tx.asset.count({ where: { currentEmployeeId: employeeId } }),
        tx.assetHistory.count({ where: { OR: [{ fromEmployeeId: employeeId }, { toEmployeeId: employeeId }] } }),
        tx.assetAssignment.count({ where: { employeeId } }),
      ]);
      if (stillHasAssets > 0 || stillHasHistory > 0 || stillHasAssignment > 0) continue;

      await tx.employee.delete({ where: { id: employeeId } });
      deletedEmployeeCount++;
    }

    console.log("\n=== HOÀN TẤT ===");
    console.log(`Asset đã xoá: ${deletedAssets.count}`);
    console.log(`Phiếu nhập kho đã xoá: ${deletedSlipCount}/${slips.length}`);
    console.log(`Model Library đã xoá: ${deletedModels.count}`);
    console.log(`Nhân viên tạm (PENDING-*) đã xoá: ${deletedEmployeeCount}`);
    console.log("\nWarehouse, User, và các data khác không liên quan được giữ nguyên.");
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
