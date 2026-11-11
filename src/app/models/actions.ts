"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/modules/audit/audit-log.service";

// Xoá model là xoá dữ liệu gốc dùng chung toàn hệ thống — chỉ Admin được
// làm, giống các trang Quản lý kho/Khu vực.
export async function deleteModelAction(formData: FormData) {
  const currentUser = await requireRole(["Admin"]);

  const id = Number(formData.get("id"));

  // Chặn xoá nếu vẫn còn thiết bị đang dùng model này — Asset.modelId là
  // FK bắt buộc (không nullable), xoá thẳng sẽ lỗi ràng buộc DB hoặc để lại
  // asset mồ côi. Bắt Admin xoá/chuyển hết thiết bị thuộc model này trước.
  const assetCount = await prisma.asset.count({ where: { modelId: id } });

  if (assetCount > 0) {
    redirect(`/models?error=in_use&assets=${assetCount}`);
  }

  const model = await prisma.assetModel.findUnique({ where: { id } });

  await prisma.assetModel.delete({ where: { id } });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá Model",
    targetType: "AssetModel",
    targetId: id,
    detail: model ? `${model.modelCode} - ${model.modelName}` : null,
  });

  redirect("/models?success=deleted");
}

// Gộp nhiều model bị trùng thông tin nhưng khác Model Code (VD: import Excel
// hoặc nhập tay tạo ra "IP16PL128"/"IPhone 16 plus 128GB" và
// "IP16PLUS128"/"IPhone 16 Plus 128GB" — cùng 1 model thật nhưng lệch mã do
// gõ khác nhau). KHÔNG tự động phát hiện (khác brand/modelName/modelCode nên
// so khớp chuỗi không đáng tin) — Admin tự chọn tay các model muốn gộp trên
// trang /models rồi chọn 1 bản giữ lại. Chỉ Admin được làm — trang /models
// vốn đã giới hạn chỉ Admin truy cập (xem MENU_ACCESS.models), action này
// tự kiểm tra lại 1 lần nữa cho chắc, không phụ thuộc hoàn toàn vào gate ở
// trang.
export async function mergeModelsAction(formData: FormData) {
  const currentUser = await requireRole(["Admin"]);

  const ids = String(formData.get("ids") || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  const primaryId = Number(formData.get("primaryId"));

  if (!primaryId || ids.length < 2 || !ids.includes(primaryId)) {
    redirect(
      `/models?error=${encodeURIComponent("Dữ liệu gộp model không hợp lệ.")}`
    );
  }

  const duplicateIds = ids.filter((id) => id !== primaryId);

  // Lấy tên/mã trước khi transaction xoá mất — chỉ dùng để ghi audit log cho
  // dễ đọc, không ảnh hưởng logic gộp.
  const modelsBeforeMerge = await prisma.assetModel.findMany({
    where: { id: { in: ids } },
  });

  await prisma.$transaction(async (tx) => {
    // Chuyển toàn bộ thiết bị đang thuộc các model bị gộp sang model được
    // chọn giữ lại — Asset.modelId là FK bắt buộc nên phải chuyển trước khi
    // xoá model cũ, không thì lỗi ràng buộc DB.
    await tx.asset.updateMany({
      where: { modelId: { in: duplicateIds } },
      data: { modelId: primaryId },
    });

    // Bù các trường mô tả còn thiếu ở bản giữ lại từ các bản bị gộp, tránh
    // mất dữ liệu (VD bản giữ lại chưa có defaultCpu nhưng bản bị gộp có).
    const primary = await tx.assetModel.findUnique({ where: { id: primaryId } });
    const duplicates = await tx.assetModel.findMany({
      where: { id: { in: duplicateIds } },
    });

    if (primary) {
      await tx.assetModel.update({
        where: { id: primaryId },
        data: {
          defaultCpu: primary.defaultCpu ?? duplicates.find((d) => d.defaultCpu)?.defaultCpu ?? null,
          defaultRam: primary.defaultRam ?? duplicates.find((d) => d.defaultRam)?.defaultRam ?? null,
          defaultStorage:
            primary.defaultStorage ?? duplicates.find((d) => d.defaultStorage)?.defaultStorage ?? null,
          defaultScreen:
            primary.defaultScreen ?? duplicates.find((d) => d.defaultScreen)?.defaultScreen ?? null,
          defaultGpu: primary.defaultGpu ?? duplicates.find((d) => d.defaultGpu)?.defaultGpu ?? null,
          note: primary.note ?? duplicates.find((d) => d.note)?.note ?? null,
        },
      });
    }

    // Chuyển luôn mã UPC/EAN của các model bị gộp sang bản giữ lại (FK
    // onDelete Cascade — không chuyển thì xoá model cũ sẽ mất mã).
    await tx.assetModelBarcode.updateMany({
      where: { modelId: { in: duplicateIds } },
      data: { modelId: primaryId },
    });

    await tx.assetModel.deleteMany({ where: { id: { in: duplicateIds } } });
  });

  const primaryLabel = modelsBeforeMerge.find((m) => m.id === primaryId);
  const duplicateLabels = modelsBeforeMerge.filter((m) => duplicateIds.includes(m.id));

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Gộp Model",
    targetType: "AssetModel",
    targetId: primaryId,
    detail: `Giữ lại: ${primaryLabel?.modelCode ?? primaryId} - ${primaryLabel?.modelName ?? ""}. Đã gộp và xoá: ${duplicateLabels.map((m) => `${m.modelCode ?? m.id} - ${m.modelName}`).join(", ")}`,
  });

  redirect("/models?success=merged");
}
