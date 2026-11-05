import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  HANDOVER_PHOTO_FILENAME_RE,
  isJpegBuffer,
} from "@/modules/asset/handover-photo.helpers";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { computeWarehouseScope, scopeIncludesWarehouse } from "@/modules/auth/warehouse-scope";
import { INVENTORY_PHOTO_FIELD, INVENTORY_PHOTO_MAX_BYTES } from "./inventory.helpers";

// Ảnh kiểm kê lưu cạnh ảnh bàn giao, trong cùng volume /app/uploads (bind-mount
// ~/itams/uploads trên VPS, xem docker-compose.yml) — tự được backup cùng
// thư mục uploads. Viết đường dẫn TĨNH (xem chú thích HANDOVER_UPLOAD_DIR)
// để Turbopack không kéo cả dự án vào output standalone.
export const INVENTORY_UPLOAD_DIR = path.join(process.cwd(), "uploads", "inventory");

// Cùng định dạng tên file "YYYY/MM/<uuid>.jpg" với ảnh bàn giao.
const FILENAME_RE = HANDOVER_PHOTO_FILENAME_RE;

export type ExtractedInventoryPhoto =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string };

/** Đúng 1 ảnh, phải là JPEG thật (kiểm magic bytes), không quá dung lượng. */
export async function extractInventoryPhoto(formData: FormData): Promise<ExtractedInventoryPhoto> {
  const value = formData.get(INVENTORY_PHOTO_FIELD);

  if (!(value instanceof Blob) || value.size === 0) {
    return { ok: false, error: "Chưa có ảnh chụp." };
  }
  if (value.size > INVENTORY_PHOTO_MAX_BYTES) {
    return { ok: false, error: "Ảnh quá lớn, vui lòng chụp lại." };
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  if (!isJpegBuffer(buffer)) {
    return { ok: false, error: "File gửi lên không phải ảnh hợp lệ." };
  }

  return { ok: true, buffer };
}

export async function saveInventoryPhoto(
  buffer: Buffer
): Promise<{ fileName: string; sizeBytes: number }> {
  const now = new Date();
  const subDir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  await fs.mkdir(path.join(INVENTORY_UPLOAD_DIR, subDir), { recursive: true, mode: 0o755 });

  const fileName = `${subDir}/${randomUUID()}.jpg`;
  await fs.writeFile(path.join(INVENTORY_UPLOAD_DIR, fileName), buffer, {
    flag: "wx",
    mode: 0o644,
  });

  return { fileName, sizeBytes: buffer.length };
}

export function resolveInventoryPhotoPath(fileName: string): string {
  // Regex chỉ cho đúng "YYYY/MM/<uuid>.jpg" — không thể thoát khỏi thư mục gốc.
  if (!FILENAME_RE.test(fileName)) {
    throw new Error("Tên file ảnh không hợp lệ.");
  }
  return path.join(INVENTORY_UPLOAD_DIR, fileName);
}

/** Xoá file ảnh — bỏ qua file không tồn tại/tên không hợp lệ, không ném lỗi. */
export async function removeInventoryPhoto(fileName: string | null | undefined) {
  if (!fileName) return;
  try {
    await fs.unlink(resolveInventoryPhotoPath(fileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error("INVENTORY_PHOTO_UNLINK_ERROR:", fileName, error);
    }
  }
}

/** Danh sách kho người dùng được phép kiểm kê (null = không giới hạn). */
export async function getAuditableWarehouses(regionWarehouseIds: number[] | null) {
  return prisma.warehouse.findMany({
    where: regionWarehouseIds ? { id: { in: regionWarehouseIds } } : {},
    orderBy: { code: "asc" },
  });
}

type InventoryViewer = {
  id: number;
  role: { name: string };
  regionWarehouseIds: number[] | null;
};

/**
 * Quyền xem/thao tác 1 đợt kiểm kê:
 * - Admin: mọi đợt thuộc phạm vi kho của mình (giám sát).
 * - IT: CHỈ đợt mà mình được chọn tham gia (và vẫn trong phạm vi kho).
 * - Role khác: không.
 */
export function canAccessInventoryAudit(
  user: InventoryViewer,
  audit: { warehouseId: number | null; participants: { userId: number }[] }
): boolean {
  if (!scopeIncludesWarehouse(user.regionWarehouseIds, audit.warehouseId)) return false;
  if (user.role.name === ROLE_ADMIN) return true;
  if (user.role.name === ROLE_IT) {
    return audit.participants.some((p) => p.userId === user.id);
  }
  return false;
}

/**
 * IT được phép chọn tham gia kiểm kê, theo từng kho: IT có phạm vi kho bao
 * gồm kho đó (cùng quy tắc phạm vi với getCurrentUser()).
 */
export async function getEligibleInventoryUsersByWarehouse(warehouseIds: number[]) {
  const [itUsers, shared] = await Promise.all([
    prisma.user.findMany({
      where: { role: { name: ROLE_IT } },
      include: {
        region: { include: { warehouses: { select: { id: true } } } },
        warehouseAccess: { select: { warehouseId: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.warehouse.findMany({ where: { isShared: true }, select: { id: true } }),
  ]);
  const sharedIds = shared.map((w) => w.id);

  const withScope = itUsers.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    scope: computeWarehouseScope({
      warehouseId: user.warehouseId,
      regionWarehouseIds: user.region ? user.region.warehouses.map((w) => w.id) : null,
      customWarehouseIds: user.warehouseAccess.map((w) => w.warehouseId),
      sharedWarehouseIds: sharedIds,
    }),
  }));

  return new Map(
    warehouseIds.map((warehouseId) => [
      warehouseId,
      withScope
        .filter((user) => scopeIncludesWarehouse(user.scope, warehouseId))
        .map(({ id, fullName, username }) => ({ id, fullName, username })),
    ])
  );
}

/**
 * Các đợt kiểm kê người dùng được thấy (xem canAccessInventoryAudit) — đang
 * kiểm kê lên trước, rồi mới nhất.
 */
export async function getInventoryAudits(user: InventoryViewer) {
  const regionWarehouseIds = user.regionWarehouseIds;
  const audits = await prisma.inventoryAudit.findMany({
    where: {
      ...(regionWarehouseIds ? { warehouseId: { in: regionWarehouseIds } } : {}),
      // Admin thấy hết trong phạm vi kho; IT chỉ thấy đợt mình tham gia.
      ...(user.role.name === ROLE_ADMIN
        ? {}
        : { participants: { some: { userId: user.id } } }),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: { select: { items: true } },
      participants: {
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const confirmedCounts = await prisma.inventoryAuditItem.groupBy({
    by: ["auditId"],
    where: { auditId: { in: audits.map((a) => a.id) }, confirmedAt: { not: null } },
    _count: { _all: true },
  });
  const confirmedByAudit = new Map(confirmedCounts.map((row) => [row.auditId, row._count._all]));

  return audits
    .map((audit) => ({
      ...audit,
      totalCount: audit._count.items,
      confirmedCount: confirmedByAudit.get(audit.id) ?? 0,
    }))
    .sort((a, b) => {
      const aOpen = a.status === "IN_PROGRESS" ? 1 : 0;
      const bOpen = b.status === "IN_PROGRESS" ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
}

/**
 * Chi tiết 1 đợt kiểm kê + trạng thái HIỆN TẠI của từng thiết bị (để báo cáo
 * chỉ ra máy đã rời kho/đổi trạng thái trong lúc đang kiểm kê).
 */
export async function getInventoryAuditDetail(auditId: number) {
  return prisma.inventoryAudit.findUnique({
    where: { id: auditId },
    include: {
      warehouse: true,
      participants: {
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
      items: {
        orderBy: { assetTag: "asc" },
        include: {
          asset: {
            select: { id: true, status: true, warehouseId: true, liquidatedAt: true },
          },
        },
      },
    },
  });
}
