import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";
import { resolveHandoverPhotoPath } from "@/modules/asset/handover-photo.service";

// Phục vụ ảnh xác nhận bàn giao. Cố tình KHÔNG để đuôi ".jpg" trên URL:
// middleware.ts cho qua KHÔNG cần đăng nhập mọi đường dẫn kết thúc bằng đuôi
// ảnh (để ảnh tĩnh trong public/ tải được ở trang /login) — URL dạng
// /handover-photos/123 vẫn đi qua middleware + requireLogin() bên dưới.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await requireLogin();

  const { id } = await params;
  const photoId = Number(id);

  if (!Number.isInteger(photoId) || photoId <= 0) {
    return new Response("Không tìm thấy ảnh.", { status: 404 });
  }

  const photo = await prisma.assetHistoryPhoto.findUnique({
    where: { id: photoId },
    include: {
      history: {
        select: {
          asset: { select: { warehouseId: true, pendingTransferToWarehouseId: true } },
        },
      },
    },
  });

  if (!photo) {
    return new Response("Không tìm thấy ảnh.", { status: 404 });
  }

  // Cùng quy tắc phạm vi kho với trang chi tiết thiết bị (assets/[id]/page.tsx):
  // xem được nếu thiết bị thuộc kho trong phạm vi, hoặc đang chuyển đến kho
  // trong phạm vi. Ngoài phạm vi trả 404 (không lộ là ảnh có tồn tại).
  const { warehouseId, pendingTransferToWarehouseId } = photo.history.asset;
  const scope = currentUser.regionWarehouseIds;
  const inScope =
    !scope ||
    (warehouseId !== null && scope.includes(warehouseId)) ||
    (pendingTransferToWarehouseId !== null && scope.includes(pendingTransferToWarehouseId));

  if (!inScope) {
    return new Response("Không tìm thấy ảnh.", { status: 404 });
  }

  let filePath: string;
  let size: number;
  try {
    filePath = resolveHandoverPhotoPath(photo.fileName);
    size = (await stat(filePath)).size;
  } catch {
    // File mất trên đĩa (VD: khôi phục DB từ backup cũ hơn thư mục ảnh).
    return new Response("Không tìm thấy file ảnh.", { status: 404 });
  }

  const webStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(webStream, {
    headers: {
      // Luôn trả image/jpeg (server chỉ nhận JPEG, đã kiểm magic bytes lúc
      // upload) + nosniff (đã set global ở next.config.ts) — trình duyệt
      // không bao giờ diễn giải file này thành HTML/script.
      "Content-Type": "image/jpeg",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="ban-giao-${photo.id}.jpg"`,
      // Không cache — ảnh bị Admin xoá hoặc user mất quyền kho thì phải
      // không xem lại được nữa (middleware.ts cũng set no-store mọi response).
      "Cache-Control": "private, no-store",
    },
  });
}
