"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { SupplyTransactionType } from "@prisma/client";
import { redirect } from "next/navigation";

export type CreateSupplyState = { error: string } | null;

export async function createSupplyAction(
  _prevState: CreateSupplyState,
  formData: FormData
): Promise<CreateSupplyState> {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const quantity = Math.max(0, Number(formData.get("quantity") || 0));
  const minQuantity = Math.max(0, Number(formData.get("minQuantity") || 0));
  const note = String(formData.get("note") || "").trim();

  // IT bị gán Region chỉ tạo được vào 1 kho thuộc Region đó — không tin
  // warehouseId gửi từ client (form đã giới hạn lựa chọn ở UI, nhưng vẫn
  // phải chặn lại ở đây để tránh gọi thẳng action với warehouseId khác).
  const submittedWarehouseId = Number(formData.get("warehouseId")) || null;

  if (
    currentUser.regionWarehouseIds &&
    (submittedWarehouseId === null ||
      !currentUser.regionWarehouseIds.includes(submittedWarehouseId))
  ) {
    return { error: "Kho này không thuộc khu vực bạn được phân quyền quản lý." };
  }

  const warehouseId = submittedWarehouseId;

  if (!code || !name || !unit) {
    return { error: "Thiếu mã, tên, hoặc đơn vị tính của vật tư" };
  }

  const existed = await prisma.supply.findUnique({ where: { code } });

  if (existed) {
    return { error: "Mã vật tư này đã tồn tại" };
  }

  const supply = await prisma.$transaction(async (tx) => {
    const created = await tx.supply.create({
      data: {
        code,
        name,
        unit,
        quantity,
        minQuantity,
        note: note || null,
        warehouseId,
      },
    });

    // Ghi log nhập kho ban đầu nếu có số lượng khởi tạo, để lịch sử giao
    // dịch phản ánh đúng toàn bộ nguồn gốc số tồn kho hiện tại (không có
    // giao dịch "từ trên trời rơi xuống").
    if (quantity > 0) {
      await tx.supplyTransaction.create({
        data: {
          supplyId: created.id,
          type: SupplyTransactionType.STOCK_IN,
          quantity,
          note: "Số lượng tồn kho ban đầu",
          createdBy: currentUser.fullName,
        },
      });
    }

    return created;
  });

  redirect(`/supplies/${supply.id}`);
}
