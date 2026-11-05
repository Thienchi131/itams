"use server";

import { AssetStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { withFlash } from "@/lib/flash";
import { assertWarehouseScope, requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import {
  INVENTORY_SCOPE_LABEL,
  parseInventoryScope,
} from "@/modules/inventory/inventory.helpers";
import {
  canAccessInventoryAudit,
  extractInventoryPhoto,
  getEligibleInventoryUsersByWarehouse,
  removeInventoryPhoto,
  saveInventoryPhoto,
} from "@/modules/inventory/inventory.service";

export type InventoryActionState = { error: string } | null;

/**
 * Tạo đợt kiểm kê cho 1 kho + 1 hạng mục: chụp lại (snapshot) danh sách thiết
 * bị đang thuộc hạng mục đó tại kho ngay lúc tạo.
 */
export async function createInventoryAuditAction(
  _prevState: InventoryActionState,
  formData: FormData
): Promise<InventoryActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const warehouseId = Number(formData.get("warehouseId"));
  const scope = parseInventoryScope(formData.get("scope"));
  const note = String(formData.get("note") || "").trim().slice(0, 500);

  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return { error: "Vui lòng chọn kho cần kiểm kê." };
  }
  if (!scope) {
    return { error: "Vui lòng chọn hạng mục kiểm kê." };
  }

  // Chặn tạo đợt cho kho ngoài phạm vi được gán (form chỉ ẩn ở UI).
  assertWarehouseScope(currentUser, warehouseId);

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    return { error: "Kho không tồn tại, vui lòng tải lại trang." };
  }

  // IT tham gia kiểm kê — chỉ những IT này (cùng Admin) thấy và thao tác
  // được đợt. Người tạo là IT thì luôn được thêm vào. Validate lại ở server:
  // chỉ nhận IT có phạm vi kho bao gồm kho này.
  const eligible =
    (await getEligibleInventoryUsersByWarehouse([warehouseId])).get(warehouseId) ?? [];
  const eligibleIds = new Set(eligible.map((user) => user.id));
  const participantIds = new Set(
    formData
      .getAll("participantIds")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  if (currentUser.role.name === ROLE_IT) participantIds.add(currentUser.id);

  if ([...participantIds].some((id) => !eligibleIds.has(id) && id !== currentUser.id)) {
    return { error: "Danh sách IT tham gia không hợp lệ, vui lòng tải lại trang." };
  }
  if (participantIds.size === 0) {
    return { error: "Vui lòng chọn ít nhất 1 IT tham gia kiểm kê." };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Khoá theo (kho, hạng mục) trong transaction — 2 người bấm "Tạo" cùng
    // lúc không tạo ra 2 đợt đang kiểm kê trùng nhau.
    const lockKey = `inventory:${warehouseId}:${scope}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await tx.inventoryAudit.findFirst({
      where: { warehouseId, scope, status: "IN_PROGRESS" },
      select: { id: true },
    });
    if (existing) {
      return { kind: "exists" as const, auditId: existing.id };
    }

    const assets = await tx.asset.findMany({
      where:
        scope === "IN_STOCK"
          ? { warehouseId, status: AssetStatus.IN_STOCK }
          : { warehouseId, status: AssetStatus.RETIRED, liquidatedAt: null },
      include: { model: true },
      orderBy: { assetTag: "asc" },
    });

    if (assets.length === 0) {
      return { kind: "empty" as const };
    }

    const audit = await tx.inventoryAudit.create({
      data: {
        warehouseId,
        warehouseLabel: `${warehouse.code} - ${warehouse.name}`,
        scope,
        note: note || null,
        createdBy: currentUser.fullName,
        participants: {
          createMany: { data: [...participantIds].map((userId) => ({ userId })) },
        },
        // createMany: 1 câu INSERT cho cả danh sách (kho vài nghìn máy vẫn
        // nhanh), thay vì mỗi máy 1 câu.
        items: {
          createMany: {
            data: assets.map((asset) => ({
              assetId: asset.id,
              assetTag: asset.assetTag,
              serialNumber: asset.serialNumber,
              modelLabel: `${asset.model.brand} ${asset.model.modelName}`,
            })),
          },
        },
      },
      select: { id: true },
    });

    return { kind: "created" as const, auditId: audit.id };
  }, { timeout: 30_000, maxWait: 15_000 });

  if (result.kind === "empty") {
    return {
      error: `Kho ${warehouse.code} không có thiết bị nào thuộc hạng mục "${INVENTORY_SCOPE_LABEL[scope]}".`,
    };
  }

  if (result.kind === "exists") {
    redirect(withFlash(`/inventory/${result.auditId}`, "inventory_already_open"));
  }

  redirect(withFlash(`/inventory/${result.auditId}`, "inventory_created"));
}

export type ConfirmItemResult =
  | { ok: true; confirmedAt: string; confirmedBy: string }
  | { ok: false; error: string };

/**
 * Xác nhận 1 thiết bị còn hiện hữu bằng ảnh chụp trực tiếp (S/N + máy). Gọi
 * thẳng từ client (không redirect) để IT chụp liên tục cả danh sách dài mà
 * trang không bị nhảy về đầu. Chụp lại thì thay ảnh cũ.
 */
export async function confirmInventoryItemAction(formData: FormData): Promise<ConfirmItemResult> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const itemId = Number(formData.get("itemId"));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return { ok: false, error: "Thiết bị không hợp lệ." };
  }

  const item = await prisma.inventoryAuditItem.findUnique({
    where: { id: itemId },
    include: { audit: { include: { participants: { select: { userId: true } } } } },
  });
  // Không được tham gia đợt / ngoài phạm vi kho -> báo như không tồn tại
  // (trả lỗi, không throw — gọi thẳng từ client, throw hiện thành "mất kết nối").
  if (!item || !canAccessInventoryAudit(currentUser, item.audit)) {
    return { ok: false, error: "Không tìm thấy thiết bị trong đợt kiểm kê, vui lòng tải lại trang." };
  }
  if (item.audit.status !== "IN_PROGRESS") {
    return { ok: false, error: "Đợt kiểm kê đã kết thúc, không thể xác nhận thêm." };
  }

  const photo = await extractInventoryPhoto(formData);
  if (!photo.ok) {
    return { ok: false, error: photo.error };
  }

  let saved: { fileName: string; sizeBytes: number };
  try {
    saved = await saveInventoryPhoto(photo.buffer);
  } catch (error) {
    console.error("INVENTORY_PHOTO_SAVE_ERROR:", error);
    return {
      ok: false,
      error: "Không lưu được ảnh lên máy chủ (thư mục lưu ảnh lỗi hoặc đầy). Vui lòng báo Admin.",
    };
  }

  const confirmedAt = new Date();

  // Khoá đợt (FOR SHARE — nhiều IT xác nhận song song được, nhưng chặn được
  // "Hoàn tất" chen giữa) + khoá dòng thiết bị (FOR UPDATE — 2 người cùng chụp
  // 1 máy thì chạy lần lượt, đọc đúng tên ảnh cũ để xoá, không mồ côi file).
  let outcome: { kind: "closed" } | { kind: "ok"; oldFileName: string | null };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const audits = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status"::text AS "status" FROM "InventoryAudit" WHERE "id" = ${item.auditId} FOR SHARE`;
      if (audits[0]?.status !== "IN_PROGRESS") {
        return { kind: "closed" as const };
      }

      const rows = await tx.$queryRaw<{ photoFileName: string | null }[]>`
        SELECT "photoFileName" FROM "InventoryAuditItem" WHERE "id" = ${itemId} FOR UPDATE`;

      await tx.inventoryAuditItem.update({
        where: { id: itemId },
        data: {
          confirmedAt,
          confirmedBy: currentUser.fullName,
          photoFileName: saved.fileName,
          photoSizeBytes: saved.sizeBytes,
        },
      });

      return { kind: "ok" as const, oldFileName: rows[0]?.photoFileName ?? null };
    });
  } catch (error) {
    await removeInventoryPhoto(saved.fileName);
    throw error;
  }

  if (outcome.kind === "closed") {
    await removeInventoryPhoto(saved.fileName);
    return { ok: false, error: "Đợt kiểm kê đã kết thúc, không thể xác nhận thêm." };
  }

  // Ảnh cũ (chụp lại) — xoá sau khi ảnh mới đã được ghi nhận.
  if (outcome.oldFileName && outcome.oldFileName !== saved.fileName) {
    await removeInventoryPhoto(outcome.oldFileName);
  }

  return { ok: true, confirmedAt: confirmedAt.toISOString(), confirmedBy: currentUser.fullName };
}

/** Hoàn tất đợt: máy chưa xác nhận được tính "Thiếu" trong báo cáo. */
export async function completeInventoryAuditAction(formData: FormData) {
  const currentUser = await requireRole(["Admin", "IT"]);
  const auditId = Number(formData.get("auditId"));
  if (!Number.isInteger(auditId) || auditId <= 0) redirect("/inventory");

  const audit = await prisma.inventoryAudit.findUnique({
    where: { id: auditId },
    include: { participants: { select: { userId: true } } },
  });
  // Chỉ IT tham gia đợt (hoặc Admin) mới hoàn tất được.
  if (!audit || !canAccessInventoryAudit(currentUser, audit)) redirect("/inventory");

  // Khoá đợt FOR UPDATE: chờ các lượt xác nhận đang ghi dở xong hẳn rồi mới
  // đóng đợt + đếm số liệu (số liệu trong Audit log khớp đúng báo cáo).
  const summary = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "InventoryAudit" WHERE "id" = ${auditId} FOR UPDATE`;

    const { count } = await tx.inventoryAudit.updateMany({
      where: { id: auditId, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", completedAt: new Date(), completedBy: currentUser.fullName },
    });
    if (count === 0) return null;

    const [total, confirmed] = await Promise.all([
      tx.inventoryAuditItem.count({ where: { auditId } }),
      tx.inventoryAuditItem.count({ where: { auditId, confirmedAt: { not: null } } }),
    ]);
    return { total, confirmed };
  });

  if (summary) {
    const { total, confirmed } = summary;
    await createAuditLog({
      actorName: currentUser.fullName,
      action: "Hoàn tất kiểm kê",
      targetType: "InventoryAudit",
      targetId: auditId,
      detail: `${audit.warehouseLabel} — ${INVENTORY_SCOPE_LABEL[audit.scope]}: xác nhận ${confirmed}/${total}, thiếu ${total - confirmed}`,
    });
  }

  redirect(withFlash(`/inventory/${auditId}`, "inventory_completed"));
}

/** Huỷ đợt đang kiểm kê (tạo nhầm) — chỉ Admin. Giữ lại dữ liệu để tra cứu. */
export async function cancelInventoryAuditAction(formData: FormData) {
  const currentUser = await requireRole([ROLE_ADMIN]);
  const auditId = Number(formData.get("auditId"));
  if (!Number.isInteger(auditId) || auditId <= 0) redirect("/inventory");

  const audit = await prisma.inventoryAudit.findUnique({ where: { id: auditId } });
  if (!audit) redirect("/inventory");

  assertWarehouseScope(currentUser, audit.warehouseId);

  const { count } = await prisma.inventoryAudit.updateMany({
    where: { id: auditId, status: "IN_PROGRESS" },
    data: { status: "CANCELLED", completedAt: new Date(), completedBy: currentUser.fullName },
  });

  if (count > 0) {
    await createAuditLog({
      actorName: currentUser.fullName,
      action: "Huỷ đợt kiểm kê",
      targetType: "InventoryAudit",
      targetId: auditId,
      detail: `${audit.warehouseLabel} — ${INVENTORY_SCOPE_LABEL[audit.scope]}`,
    });
  }

  redirect(withFlash("/inventory", "inventory_cancelled"));
}
