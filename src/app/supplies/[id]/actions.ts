"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, assertWarehouseScope } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { SupplyTransactionType } from "@prisma/client";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/modules/audit/audit-log.service";

export type SupplyTxState = { error: string } | null;

export async function stockInSupplyAction(
  _prevState: SupplyTxState,
  formData: FormData
): Promise<SupplyTxState> {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const supplyId = Number(formData.get("supplyId"));
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") || "").trim();

  if (!supplyId || !quantity || quantity <= 0) {
    return { error: "Số lượng nhập không hợp lệ" };
  }

  const target = await prisma.supply.findUnique({ where: { id: supplyId } });

  if (!target) {
    return { error: "Không tìm thấy vật tư" };
  }

  assertWarehouseScope(currentUser, target.warehouseId);

  await prisma.$transaction(async (tx) => {
    await tx.supply.update({
      where: { id: supplyId },
      data: { quantity: { increment: quantity } },
    });

    await tx.supplyTransaction.create({
      data: {
        supplyId,
        type: SupplyTransactionType.STOCK_IN,
        quantity,
        note: note || null,
        createdBy: currentUser.fullName,
      },
    });
  });

  redirect(`/supplies/${supplyId}`);
}

// Xoá vĩnh viễn 1 vật tư — dùng cho trường hợp tạo nhầm/tạo trùng mã lúc
// khởi tạo danh mục. CHỈ Admin được làm, và CHỈ khi tồn kho đang = 0 (chặn ở
// cả UI lẫn action) — vật tư còn tồn kho thực tế thì phải xuất hết trước,
// tránh xoá mất "sổ sách" của số lượng vẫn còn tồn tại ngoài đời. Bắt buộc
// nhập lý do — không cho xoá "chay" không giải trình, giống deleteAssetAction.
export async function deleteSupplyAction(
  _prevState: SupplyTxState,
  formData: FormData
): Promise<SupplyTxState> {
  const currentUser = await requireRole([ROLE_ADMIN]);

  const supplyId = Number(formData.get("supplyId"));
  const reason = String(formData.get("reason") || "").trim();

  if (!reason) {
    return { error: "Vui lòng nhập lý do xoá vật tư." };
  }

  const supply = await prisma.supply.findUnique({ where: { id: supplyId } });

  if (!supply) {
    return { error: "Vật tư không tồn tại hoặc đã bị xoá trước đó." };
  }

  assertWarehouseScope(currentUser, supply.warehouseId);

  if (supply.quantity !== 0) {
    return {
      error: `Chỉ được xoá vật tư khi tồn kho = 0 — hiện còn ${supply.quantity} ${supply.unit}. Xuất hết tồn kho trước khi xoá.`,
    };
  }

  const supplyLabel = `${supply.code} - ${supply.name} (${supply.unit})`;

  // Supply không có onDelete: Cascade tới SupplyTransaction — phải tự xoá
  // hết lịch sử nhập/xuất liên quan trong 1 transaction trước, nếu không
  // Prisma báo lỗi ràng buộc khoá ngoại (P2003).
  await prisma.$transaction([
    prisma.supplyTransaction.deleteMany({ where: { supplyId } }),
    prisma.supply.delete({ where: { id: supplyId } }),
  ]);

  // Ghi vào AuditLog thay vì chỉ SupplyTransaction — lịch sử nhập/xuất của
  // chính vật tư này vừa bị xoá sạch cùng lúc, ghi vào đó thì mất luôn bằng
  // chứng, không còn ai tra cứu lại được đã xoá lúc nào/ai xoá/vì sao.
  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá vật tư",
    targetType: "Supply",
    targetId: supplyId,
    detail: `${supplyLabel}. Lý do: ${reason}`,
  });

  redirect("/supplies?success=supply_deleted");
}

export async function stockOutSupplyAction(
  _prevState: SupplyTxState,
  formData: FormData
): Promise<SupplyTxState> {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const supplyId = Number(formData.get("supplyId"));
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") || "").trim();

  if (!supplyId || !quantity || quantity <= 0) {
    return { error: "Số lượng xuất không hợp lệ" };
  }

  if (!note) {
    return { error: "Vui lòng nhập ghi chú (lý do xuất kho)" };
  }

  const supply = await prisma.supply.findUnique({ where: { id: supplyId } });

  if (!supply) {
    return { error: "Không tìm thấy vật tư" };
  }

  assertWarehouseScope(currentUser, supply.warehouseId);

  if (quantity > supply.quantity) {
    return {
      error: `Không đủ tồn kho — hiện chỉ còn ${supply.quantity} ${supply.unit}`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.supply.update({
      where: { id: supplyId },
      data: { quantity: { decrement: quantity } },
    });

    await tx.supplyTransaction.create({
      data: {
        supplyId,
        type: SupplyTransactionType.STOCK_OUT,
        quantity,
        note: note || null,
        createdBy: currentUser.fullName,
      },
    });
  });

  redirect(`/supplies/${supplyId}`);
}
