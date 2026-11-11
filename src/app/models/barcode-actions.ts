"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import {
  formatModelBarcode,
  MODEL_BARCODE_REJECT_LABEL,
  normalizeModelBarcode,
} from "@/modules/asset/model-barcode";

export type ModelBarcodeItem = { id: number; code: string };

type ModelLabel = { id: number; modelCode: string | null; brand: string; modelName: string };

function modelLabel(m: ModelLabel) {
  return `${m.modelCode ? `${m.modelCode} — ` : ""}${m.brand} ${m.modelName}`;
}

// Gắn 1 mã UPC/EAN vào model — CHỈ Admin (IT quét ra mã lạ ở phiếu nhập
// kho thì báo Admin gắn, tránh mỗi người gắn 1 kiểu lại sinh model trùng).
export async function addModelBarcodeAction(
  modelId: number,
  raw: string
): Promise<
  | { ok: true; barcode: ModelBarcodeItem; alreadyOnThisModel?: boolean }
  | { ok: false; error: string }
> {
  const currentUser = await requireRole([ROLE_ADMIN]);

  const normalized = normalizeModelBarcode(raw);
  if (!normalized.ok) return { ok: false, error: MODEL_BARCODE_REJECT_LABEL[normalized.reason] };
  const code = normalized.code;
  const shown = formatModelBarcode(code);

  const model = await prisma.assetModel.findUnique({
    where: { id: modelId },
    select: { id: true, modelCode: true, brand: true, modelName: true },
  });
  if (!model) return { ok: false, error: "Model không tồn tại (có thể đã bị xoá/gộp)." };

  const existing = await prisma.assetModelBarcode.findUnique({
    where: { code },
    include: { model: { select: { id: true, modelCode: true, brand: true, modelName: true } } },
  });
  if (existing) {
    if (existing.modelId === modelId) {
      return { ok: true, barcode: { id: existing.id, code: existing.code }, alreadyOnThisModel: true };
    }
    return {
      ok: false,
      error: `Mã ${shown} đang gắn với model khác: ${modelLabel(existing.model)}. Xoá mã ở model đó trước nếu gắn nhầm.`,
    };
  }

  try {
    const created = await prisma.assetModelBarcode.create({
      data: { code, modelId, createdByName: currentUser.fullName },
    });

    await createAuditLog({
      actorName: currentUser.fullName,
      action: "Gắn mã UPC cho Model",
      targetType: "AssetModel",
      targetId: modelId,
      detail: `${shown} → ${modelLabel(model)}`,
    });

    revalidatePath(`/models/${modelId}`);
    return { ok: true, barcode: { id: created.id, code: created.code } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: `Mã ${shown} vừa được gắn cho model khác. Tải lại trang để xem.` };
    }
    throw err;
  }
}

export async function removeModelBarcodeAction(barcodeId: number): Promise<{ ok: boolean }> {
  const currentUser = await requireRole([ROLE_ADMIN]);

  const barcode = await prisma.assetModelBarcode.findUnique({
    where: { id: barcodeId },
    include: { model: { select: { id: true, modelCode: true, brand: true, modelName: true } } },
  });
  if (!barcode) return { ok: true };

  await prisma.assetModelBarcode.delete({ where: { id: barcodeId } });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá mã UPC của Model",
    targetType: "AssetModel",
    targetId: barcode.modelId,
    detail: `${formatModelBarcode(barcode.code)} khỏi ${modelLabel(barcode.model)}`,
  });

  revalidatePath(`/models/${barcode.modelId}`);
  return { ok: true };
}

// Tra model theo mã UPC/EAN quét trên hộp — dùng ở Phiếu nhập kho (Admin + IT).
export async function findModelByBarcodeAction(
  raw: string
): Promise<
  | { found: true; code: string; modelId: number; label: string }
  | { found: false; code: string | null; error?: string }
> {
  await requireRole([ROLE_ADMIN, ROLE_IT]);

  const normalized = normalizeModelBarcode(raw);
  if (!normalized.ok) {
    return { found: false, code: null, error: MODEL_BARCODE_REJECT_LABEL[normalized.reason] };
  }

  const barcode = await prisma.assetModelBarcode.findUnique({
    where: { code: normalized.code },
    include: { model: { select: { id: true, modelCode: true, brand: true, modelName: true } } },
  });

  if (!barcode) return { found: false, code: normalized.code };
  return { found: true, code: normalized.code, modelId: barcode.modelId, label: modelLabel(barcode.model) };
}
