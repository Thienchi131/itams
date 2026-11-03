"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/modules/audit/audit-log.service";

export async function updateUserAction(formData: FormData) {
  const currentUser = await requireRole(["Admin"]);

  const id = Number(formData.get("id"));
  const fullName = String(formData.get("fullName") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const roleId = Number(formData.get("roleId"));
  const regionIdRaw = String(formData.get("regionId") || "").trim();
  const warehouseIdRaw = String(formData.get("warehouseId") || "").trim();
  // Xem giải thích ở users/new/actions.ts — chỉ 1 trong 2 được set,
  // warehouseId (hẹp hơn) ưu tiên nếu cả 2 cùng có giá trị.
  const warehouseId = warehouseIdRaw ? Number(warehouseIdRaw) : null;
  const regionId = !warehouseId && regionIdRaw ? Number(regionIdRaw) : null;

  // Kho bổ sung (ExtraWarehouseAccessPicker) — xem ghi chú trong
  // UserWarehouseAccess (schema.prisma) và getCurrentUser() (auth.service.ts).
  const extraWarehouseIds = formData
    .getAll("extraWarehouseIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        fullName,
        username,
        roleId,
        regionId,
        warehouseId,
      },
    });

    // Thay toàn bộ danh sách bằng danh sách mới gửi lên — đơn giản hơn diff
    // từng dòng, và bảng này chỉ có đúng userId+warehouseId nên không có dữ
    // liệu phụ nào bị mất khi xoá/tạo lại.
    await tx.userWarehouseAccess.deleteMany({ where: { userId: id } });

    if (extraWarehouseIds.length > 0) {
      await tx.userWarehouseAccess.createMany({
        data: extraWarehouseIds.map((whId) => ({ userId: id, warehouseId: whId })),
      });
    }
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Sửa tài khoản",
    targetType: "User",
    targetId: id,
    detail: `${fullName} (${username})`,
  });

  redirect(`/users/${id}`);
}