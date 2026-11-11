"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin, assertWarehouseScope } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";
import { createAuditLog } from "@/modules/audit/audit-log.service";

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

// "yyyy-mm-dd" từ input type=date -> Date (UTC) hoặc null.
function dateOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const d = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type UpdateAssetState = { error: string } | null;

export async function updateAssetAction(
  _prevState: UpdateAssetState,
  formData: FormData
): Promise<UpdateAssetState> {
  const currentUser = await requireLogin();

  // Chỉ Admin — chặn ở cả action, không chỉ ẩn UI, phòng trường hợp IT gọi
  // thẳng action này (VD: sửa tay request) bỏ qua giao diện.
  if (currentUser.role.name !== ROLE_ADMIN) {
    return { error: "Chỉ Admin mới được chỉnh sửa thông tin thiết bị." };
  }

  const id = Number(formData.get("id"));
  const assetTag = String(formData.get("assetTag") || "").trim();
  // Chuẩn hoá viết hoa ngay lúc lưu — đồng nhất với form Nhập kho, tránh
  // serial mới sửa tay lại lệch hoa/thường so với phần còn lại của hệ thống.
  const serialNumber = String(formData.get("serialNumber") || "").trim().toUpperCase();
  const modelId = Number(formData.get("modelId"));

  if (!assetTag || !serialNumber) {
    return { error: "Thiếu Asset Tag hoặc Serial Number." };
  }

  if (!modelId) {
    return { error: "Vui lòng chọn Model thiết bị." };
  }

  const asset = await prisma.asset.findUnique({ where: { id } });

  if (!asset) {
    return { error: "Không tìm thấy thiết bị." };
  }

  const model = await prisma.assetModel.findUnique({ where: { id: modelId } });

  if (!model) {
    return { error: "Model đã chọn không tồn tại." };
  }

  assertWarehouseScope(currentUser, asset.warehouseId);

  const [duplicateTag, duplicateSerial] = await Promise.all([
    prisma.asset.findFirst({ where: { assetTag, id: { not: id } } }),
    prisma.asset.findFirst({ where: { serialNumber, id: { not: id } } }),
  ]);

  if (duplicateTag) {
    return { error: "Asset Tag này đã được dùng bởi thiết bị khác." };
  }

  if (duplicateSerial) {
    return { error: "Serial Number này đã được dùng bởi thiết bị khác." };
  }

  await prisma.asset.update({
    where: { id },
    data: {
      assetTag,
      serialNumber,
      modelId,
      color: textOrNull(formData.get("color")),
      condition: textOrNull(formData.get("condition")),
      actualCpu: textOrNull(formData.get("actualCpu")),
      actualRam: textOrNull(formData.get("actualRam")),
      actualStorage: textOrNull(formData.get("actualStorage")),
      actualScreen: textOrNull(formData.get("actualScreen")),
      actualGpu: textOrNull(formData.get("actualGpu")),
      note: textOrNull(formData.get("note")),
    },
  });

  // Bảo hành (Admin sửa/xoá — VD IT nhập nhầm máy thu hồi cũ thành mua mới).
  const removeWarranty = formData.get("removeWarranty") === "on";
  const existingWarranty = await prisma.assetWarranty.findFirst({
    where: { assetId: id },
    orderBy: { id: "asc" },
  });
  const wProvider = textOrNull(formData.get("warrantyProvider"));
  const wStart = dateOrNull(formData.get("warrantyStart"));
  const wEnd = dateOrNull(formData.get("warrantyEnd"));

  if (removeWarranty) {
    if (existingWarranty) {
      await prisma.assetWarranty.deleteMany({ where: { assetId: id } });
      await createAuditLog({
        actorName: currentUser.fullName,
        action: "Xoá bảo hành thiết bị",
        targetType: "Asset",
        targetId: id,
        detail: `${asset.assetTag} (${asset.serialNumber}) — máy thu hồi cũ, gỡ hạn bảo hành nhập nhầm`,
      });
    }
  } else if (wProvider || wStart || wEnd) {
    if (existingWarranty) {
      await prisma.assetWarranty.update({
        where: { id: existingWarranty.id },
        data: { provider: wProvider, startDate: wStart, endDate: wEnd },
      });
    } else {
      await prisma.assetWarranty.create({
        data: { assetId: id, provider: wProvider, startDate: wStart, endDate: wEnd },
      });
    }
    await createAuditLog({
      actorName: currentUser.fullName,
      action: "Sửa bảo hành thiết bị",
      targetType: "Asset",
      targetId: id,
      detail: `${asset.assetTag} (${asset.serialNumber}) — KT: ${wEnd ? wEnd.toISOString().slice(0, 10) : "-"}`,
    });
  }

  redirect(withFlash(`/assets/${id}`, "asset_updated"));
}
