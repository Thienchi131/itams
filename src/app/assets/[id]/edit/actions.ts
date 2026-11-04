"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin, assertWarehouseScope } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
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

  redirect(withFlash(`/assets/${id}`, "asset_updated"));
}
