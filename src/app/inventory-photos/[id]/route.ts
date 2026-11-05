import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import {
  canAccessInventoryAudit,
  resolveInventoryPhotoPath,
} from "@/modules/inventory/inventory.service";

// Ảnh xác nhận kiểm kê của 1 thiết bị trong đợt (theo id InventoryAuditItem).
// Không có đuôi ".jpg" trên URL — xem chú thích ở /handover-photos/[id].
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Kiểm kê chỉ dành cho Admin/IT (menu "inventory") — ảnh cũng vậy.
  const currentUser = await requireRole(["Admin", "IT"]);

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return new Response("Không tìm thấy ảnh.", { status: 404 });
  }

  const item = await prisma.inventoryAuditItem.findUnique({
    where: { id: itemId },
    select: {
      photoFileName: true,
      audit: { select: { warehouseId: true, participants: { select: { userId: true } } } },
    },
  });

  // Cùng quyền với trang đợt kiểm kê: Admin, hoặc IT được chọn tham gia.
  if (!item?.photoFileName || !canAccessInventoryAudit(currentUser, item.audit)) {
    return new Response("Không tìm thấy ảnh.", { status: 404 });
  }

  let filePath: string;
  let size: number;
  try {
    filePath = resolveInventoryPhotoPath(item.photoFileName);
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Không tìm thấy file ảnh.", { status: 404 });
  }

  const webStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="kiem-ke-${itemId}.jpg"`,
      // Chụp lại sẽ thay file nhưng giữ nguyên URL — không cache.
      "Cache-Control": "private, no-store",
    },
  });
}
