"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { checkSlipDeletable } from "@/modules/stockIn/stockIn.service";
import { redirect } from "next/navigation";

// Xoá phiếu nhập là thao tác phá huỷ dữ liệu (thiết bị + lịch sử) — chỉ
// Admin được làm, giống các trang quản lý cấu trúc khác (Kho, Khu vực).
const REQUIRE_ROLES = ["Admin"];

export async function deleteStockInSlipAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const id = Number(formData.get("id"));

  const { slip, blockedAssets, deletableAssetIds } = await checkSlipDeletable(id);

  if (!slip) {
    redirect("/settings/stock-in-slips?error=not_found");
  }

  // Chặn xoá nếu còn BẤT KỲ thiết bị nào trong phiếu đã "động" (cấp phát,
  // đổi trạng thái, có thêm lịch sử...) — báo rõ Asset Tag để Admin tự xử lý
  // tay (thu hồi/chuyển kho) trước khi xoá lại, thay vì âm thầm xoá mất
  // thiết bị đang thực sự được sử dụng.
  if (blockedAssets.length > 0) {
    const detail = blockedAssets
      .map((a) => `${a.assetTag} (${a.reason})`)
      .join("; ");

    redirect(
      `/settings/stock-in-slips?error=has_active_assets&detail=${encodeURIComponent(detail)}&slip=${encodeURIComponent(slip!.slipNo)}`
    );
  }

  await prisma.$transaction(async (tx) => {
    if (deletableAssetIds.length > 0) {
      const assets = await tx.asset.findMany({
        where: { id: { in: deletableAssetIds } },
      });
      const modelIds = [...new Set(assets.map((a) => a.modelId))];

      await tx.assetAccessory.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
      await tx.assetWarranty.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
      await tx.assetAssignment.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
      await tx.assetHistory.deleteMany({ where: { assetId: { in: deletableAssetIds } } });
      await tx.stockInItem.deleteMany({ where: { assetId: { in: deletableAssetIds } } });

      await tx.asset.deleteMany({ where: { id: { in: deletableAssetIds } } });

      // Model Library chỉ dọn nếu không còn asset nào khác (ở phiếu/kho khác)
      // tham chiếu — model dùng chung nhiều lô hàng thì phải giữ nguyên.
      const stillUsed = await tx.asset.findMany({
        where: { modelId: { in: modelIds } },
        select: { modelId: true },
        distinct: ["modelId"],
      });
      const stillUsedIds = new Set(stillUsed.map((row) => row.modelId));
      const modelIdsToDelete = modelIds.filter((mid) => !stillUsedIds.has(mid));
      await tx.assetModel.deleteMany({ where: { id: { in: modelIdsToDelete } } });
    }

    await tx.stockInSlip.delete({ where: { id } });
  });

  redirect("/settings/stock-in-slips?success=deleted");
}
