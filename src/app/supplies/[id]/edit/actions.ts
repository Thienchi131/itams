"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, assertWarehouseScope } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

export type UpdateSupplyState = { error: string } | null;

export async function updateSupplyAction(
  _prevState: UpdateSupplyState,
  formData: FormData
): Promise<UpdateSupplyState> {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const id = Number(formData.get("id"));
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const minQuantity = Math.max(0, Number(formData.get("minQuantity") || 0));
  const note = String(formData.get("note") || "").trim();
  const submittedWarehouseId = Number(formData.get("warehouseId")) || null;

  if (!code || !name || !unit) {
    return { error: "Thiếu mã, tên, hoặc đơn vị tính của vật tư" };
  }

  const supply = await prisma.supply.findUnique({ where: { id } });

  if (!supply) {
    return { error: "Không tìm thấy vật tư" };
  }

  // IT bị gán Region chỉ sửa được vật tư thuộc Region đó, và chỉ đổi được
  // sang kho khác cũng thuộc Region đó — không tin warehouseId gửi từ
  // client cho tài khoản bị giới hạn. assertWarehouseScope vẫn throw (không
  // đổi qua return {error}) vì đây là "bẫy an toàn" cho request bị chỉnh sửa
  // tay/bỏ qua UI — dropdown trên form đã tự giới hạn lựa chọn hợp lệ nên
  // người dùng bình thường không bao giờ chạm tới nhánh này.
  assertWarehouseScope(currentUser, supply.warehouseId);

  if (
    currentUser.regionWarehouseIds &&
    (submittedWarehouseId === null ||
      !currentUser.regionWarehouseIds.includes(submittedWarehouseId))
  ) {
    return { error: "Kho này không thuộc khu vực bạn được phân quyền quản lý." };
  }

  const warehouseId = submittedWarehouseId;

  const existed = await prisma.supply.findFirst({
    where: { code, id: { not: id } },
  });

  if (existed) {
    return { error: "Mã vật tư này đã tồn tại" };
  }

  await prisma.supply.update({
    where: { id },
    data: { code, name, unit, minQuantity, note: note || null, warehouseId },
  });

  redirect(withFlash(`/supplies/${id}`, "supply_updated"));
}
