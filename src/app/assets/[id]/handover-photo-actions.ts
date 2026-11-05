"use server";

import { HistoryAction } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { withFlash } from "@/lib/flash";
import { assertWarehouseScope, requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import {
  extractHandoverPhotos,
  removeHandoverPhotoFileIfUnreferenced,
  removeHandoverPhotoFiles,
  trySaveHandoverPhotoFiles,
} from "@/modules/asset/handover-photo.service";
import { HANDOVER_PHOTO_MAX_COUNT } from "@/modules/asset/handover-photo.helpers";

export type HandoverPhotoActionState = { error: string } | null;

// Giữ lại ?returnTo=... khi quay về trang chi tiết — cùng quy ước với
// detailUrl() trong ./actions.ts (nút "Quay lại" vẫn về đúng trang/filter).
function detailUrl(assetId: number, returnTo: FormDataEntryValue | null) {
  const value = typeof returnTo === "string" ? returnTo.trim() : "";
  const qs = value ? `?returnTo=${encodeURIComponent(value)}` : "";
  return `/assets/${assetId}${qs}`;
}

/**
 * Bổ sung ảnh xác nhận cho 1 lượt bàn giao đã có (dòng AssetHistory
 * action=TRANSFER). Cho phép cả sau hạn 7 ngày (vẫn tốt hơn là không có ảnh)
 * — trạng thái "quá hạn" tự hết ngay khi lượt bàn giao có ảnh.
 */
export async function addHandoverPhotosAction(
  _prevState: HandoverPhotoActionState,
  formData: FormData
): Promise<HandoverPhotoActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const historyId = Number(formData.get("historyId"));
  const returnTo = formData.get("returnTo");

  if (!Number.isInteger(historyId) || historyId <= 0) {
    return { error: "Lượt bàn giao không hợp lệ." };
  }

  const history = await prisma.assetHistory.findUnique({
    where: { id: historyId },
    include: { asset: true, _count: { select: { photos: true } } },
  });

  if (!history || history.action !== HistoryAction.TRANSFER || !history.toEmployeeId) {
    return { error: "Không tìm thấy lượt bàn giao, vui lòng tải lại trang." };
  }

  // Chặn gọi thẳng action với historyId thuộc kho ngoài phạm vi được gán.
  assertWarehouseScope(currentUser, history.asset.warehouseId);

  // Cùng quy tắc với nút "Bổ sung ảnh" ở Timeline (assets/[id]/page.tsx):
  // lượt bàn giao có hạn ảnh (photoDueAt) luôn bổ sung được; lượt bàn giao
  // CŨ chỉ khi đó là lượt bàn giao mới nhất và thiết bị vẫn ở đúng người nhận.
  if (history.photoDueAt === null) {
    const latestTransfer = await prisma.assetHistory.findFirst({
      where: { assetId: history.assetId, action: HistoryAction.TRANSFER },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (
      latestTransfer?.id !== history.id ||
      history.asset.currentEmployeeId !== history.toEmployeeId
    ) {
      return { error: "Không thể bổ sung ảnh cho lượt bàn giao cũ này." };
    }
  }

  const photos = await extractHandoverPhotos(
    formData,
    HANDOVER_PHOTO_MAX_COUNT - history._count.photos
  );
  if (!photos.ok) {
    return { error: photos.error };
  }
  if (photos.buffers.length === 0) {
    return { error: "Vui lòng chọn ít nhất 1 ảnh." };
  }

  const savedResult = await trySaveHandoverPhotoFiles(photos.buffers);
  if (!savedResult.ok) {
    return { error: savedResult.error };
  }
  const savedPhotos = savedResult.saved;

  try {
    // Đếm lại trong transaction — 2 người cùng bổ sung 1 lúc không vượt
    // được giới hạn số ảnh.
    await prisma.$transaction(async (tx) => {
      // Khoá dòng lượt bàn giao để 2 lượt bổ sung đồng thời phải chạy lần
      // lượt — nếu không, cả 2 cùng đếm thấy 3 ảnh rồi cùng thêm 2 (thành 7).
      await tx.$executeRaw`SELECT 1 FROM "AssetHistory" WHERE "id" = ${historyId} FOR UPDATE`;
      const current = await tx.assetHistoryPhoto.count({ where: { historyId } });
      if (current + savedPhotos.length > HANDOVER_PHOTO_MAX_COUNT) {
        throw new HandoverPhotoLimitError();
      }

      await tx.assetHistoryPhoto.createMany({
        data: savedPhotos.map((photo) => ({
          historyId,
          fileName: photo.fileName,
          sizeBytes: photo.sizeBytes,
          uploadedBy: currentUser.fullName,
        })),
      });
    });
  } catch (error) {
    await removeHandoverPhotoFiles(savedPhotos.map((photo) => photo.fileName));
    if (error instanceof HandoverPhotoLimitError) {
      return {
        error: `Lượt bàn giao này chỉ được tối đa ${HANDOVER_PHOTO_MAX_COUNT} ảnh — vui lòng tải lại trang.`,
      };
    }
    throw error;
  }

  redirect(withFlash(detailUrl(history.assetId, returnTo), "handover_photos_added"));
}

/**
 * Bổ sung ảnh 1 LẦN cho nhiều thiết bị cùng 1 nhân viên (trang "Ảnh bàn giao
 * chờ bổ sung", gom theo nhân viên) — ghi file 1 lần, mỗi lượt bàn giao 1
 * dòng AssetHistoryPhoto trỏ chung vào file (giống cấp hàng loạt).
 */
export async function addHandoverPhotosForEmployeeAction(
  _prevState: HandoverPhotoActionState,
  formData: FormData
): Promise<HandoverPhotoActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const employeeId = Number(formData.get("employeeId"));
  const historyIds = Array.from(
    new Set(
      String(formData.get("historyIds") || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
  const returnToRaw = String(formData.get("returnTo") || "");
  // Chỉ quay về đúng trang danh sách (giữ filter kho) — chặn open-redirect.
  const returnTo = returnToRaw.startsWith("/assets/handover-photos")
    ? returnToRaw
    : "/assets/handover-photos";

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return { error: "Nhân viên không hợp lệ." };
  }
  if (historyIds.length === 0) {
    return { error: "Vui lòng chọn ít nhất 1 thiết bị." };
  }
  if (historyIds.length > 100) {
    return { error: "Chọn tối đa 100 thiết bị mỗi lần." };
  }

  const histories = await prisma.assetHistory.findMany({
    where: { id: { in: historyIds } },
    include: { asset: true, _count: { select: { photos: true } } },
  });

  // Mọi lượt phải: tồn tại, là lượt bàn giao có hạn ảnh, đúng nhân viên này
  // nhận VÀ thiết bị vẫn đang ở nhân viên này, trong phạm vi kho được gán.
  if (histories.length !== historyIds.length) {
    return { error: "Dữ liệu đã thay đổi, vui lòng tải lại trang." };
  }
  for (const history of histories) {
    if (
      history.action !== HistoryAction.TRANSFER ||
      history.photoDueAt === null ||
      history.toEmployeeId !== employeeId ||
      history.asset.currentEmployeeId !== employeeId
    ) {
      return { error: "Dữ liệu đã thay đổi (thiết bị đã thu hồi/chuyển người), vui lòng tải lại trang." };
    }
    assertWarehouseScope(currentUser, history.asset.warehouseId);
  }

  const remainingSlots = Math.min(
    ...histories.map((history) => HANDOVER_PHOTO_MAX_COUNT - history._count.photos)
  );

  const photos = await extractHandoverPhotos(formData, remainingSlots);
  if (!photos.ok) {
    return { error: photos.error };
  }
  if (photos.buffers.length === 0) {
    return { error: "Vui lòng chọn ít nhất 1 ảnh." };
  }

  const savedResult = await trySaveHandoverPhotoFiles(photos.buffers);
  if (!savedResult.ok) {
    return { error: savedResult.error };
  }
  const savedPhotos = savedResult.saved;

  try {
    await prisma.$transaction(async (tx) => {
      // Khoá các lượt bàn giao liên quan — xem addHandoverPhotosAction.
      await tx.$executeRaw`SELECT 1 FROM "AssetHistory" WHERE "id" = ANY(${historyIds}) FOR UPDATE`;

      const counts = await tx.assetHistoryPhoto.groupBy({
        by: ["historyId"],
        where: { historyId: { in: historyIds } },
        _count: { _all: true },
      });
      if (counts.some((row) => row._count._all + savedPhotos.length > HANDOVER_PHOTO_MAX_COUNT)) {
        throw new HandoverPhotoLimitError();
      }

      await tx.assetHistoryPhoto.createMany({
        data: historyIds.flatMap((historyId) =>
          savedPhotos.map((photo) => ({
            historyId,
            fileName: photo.fileName,
            sizeBytes: photo.sizeBytes,
            uploadedBy: currentUser.fullName,
          }))
        ),
      });
    });
  } catch (error) {
    await removeHandoverPhotoFiles(savedPhotos.map((photo) => photo.fileName));
    if (error instanceof HandoverPhotoLimitError) {
      return {
        error: `Có thiết bị đã đủ ${HANDOVER_PHOTO_MAX_COUNT} ảnh — vui lòng tải lại trang.`,
      };
    }
    throw error;
  }

  redirect(withFlash(returnTo, "handover_photos_added"));
}

/** Xoá 1 ảnh bàn giao (chụp nhầm/sai máy) — chỉ Admin, có ghi Audit log. */
export async function deleteHandoverPhotoAction(formData: FormData) {
  const currentUser = await requireRole([ROLE_ADMIN]);

  const photoId = Number(formData.get("photoId"));
  const returnTo = formData.get("returnTo");

  if (!Number.isInteger(photoId) || photoId <= 0) {
    redirect("/assets");
  }

  const photo = await prisma.assetHistoryPhoto.findUnique({
    where: { id: photoId },
    include: { history: { include: { asset: true } } },
  });

  if (!photo) {
    redirect("/assets");
  }

  assertWarehouseScope(currentUser, photo.history.asset.warehouseId);

  await prisma.assetHistoryPhoto.delete({ where: { id: photoId } });
  await removeHandoverPhotoFileIfUnreferenced(photo.fileName);

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá ảnh bàn giao",
    targetType: "Asset",
    targetId: photo.history.assetId,
    detail: `Xoá ảnh bàn giao #${photo.id} của thiết bị ${photo.history.asset.assetTag} (lượt bàn giao #${photo.historyId}, tải lên bởi ${photo.uploadedBy ?? "-"})`,
  });

  redirect(withFlash(detailUrl(photo.history.assetId, returnTo), "handover_photo_deleted"));
}

class HandoverPhotoLimitError extends Error {}
