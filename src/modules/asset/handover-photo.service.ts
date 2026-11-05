import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { HistoryAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getHandoverPhotoStatus,
  HANDOVER_PHOTO_FIELD,
  HANDOVER_PHOTO_FILENAME_RE,
  HANDOVER_PHOTO_MAX_BYTES,
  HANDOVER_PHOTO_MAX_COUNT,
  isJpegBuffer,
} from "./handover-photo.helpers";

// Thư mục gốc lưu ảnh bàn giao. Trong Docker là /app/uploads/handover —
// /app/uploads được bind-mount ra ~/itams/uploads trên VPS (docker-compose.yml)
// để ảnh KHÔNG mất khi build/deploy lại container. Ở máy dev là
// <thư mục dự án>/uploads/handover (đã gitignore).
// Cố tình viết TĨNH dạng path.join(process.cwd(), "uploads", ...) (không đọc
// biến môi trường, không path.resolve động) — cùng kiểu với BACKUP_DIR trong
// backup.service.ts. Viết động khiến Turbopack lúc build tưởng code đọc file
// bất kỳ và kéo TOÀN BỘ dự án vào output standalone (image Docker phình to).
export const HANDOVER_UPLOAD_DIR = path.join(process.cwd(), "uploads", "handover");

export type ExtractedPhotos =
  | { ok: true; buffers: Buffer[] }
  | { ok: false; error: string };

/**
 * Đọc + kiểm tra các file ảnh trong FormData. Không tin phía client: ảnh phải
 * là JPEG thật (kiểm magic bytes, không dựa vào tên/MIME do trình duyệt khai
 * báo), không vượt dung lượng, không vượt số lượng còn được phép.
 */
export async function extractHandoverPhotos(
  formData: FormData,
  remainingSlots: number = HANDOVER_PHOTO_MAX_COUNT
): Promise<ExtractedPhotos> {
  const files = formData
    .getAll(HANDOVER_PHOTO_FIELD)
    .filter((value): value is File => value instanceof Blob && value.size > 0);

  if (files.length > remainingSlots) {
    return {
      ok: false,
      error:
        remainingSlots <= 0
          ? `Lượt bàn giao này đã đủ ${HANDOVER_PHOTO_MAX_COUNT} ảnh.`
          : `Chỉ được thêm tối đa ${remainingSlots} ảnh nữa (tối đa ${HANDOVER_PHOTO_MAX_COUNT} ảnh mỗi lượt bàn giao).`,
    };
  }

  const buffers: Buffer[] = [];

  for (const file of files) {
    if (file.size > HANDOVER_PHOTO_MAX_BYTES) {
      return {
        ok: false,
        error: "Ảnh quá lớn. Vui lòng tải lại trang rồi chọn ảnh lại (ảnh sẽ được nén tự động).",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!isJpegBuffer(buffer)) {
      return { ok: false, error: "File tải lên không phải ảnh hợp lệ." };
    }

    buffers.push(buffer);
  }

  return { ok: true, buffers };
}

export type SavedPhotoFile = { fileName: string; sizeBytes: number };

/**
 * Ghi ảnh xuống đĩa, trả về tên file (tương đối) để lưu DB. Nếu lỗi giữa
 * chừng thì tự xoá các file đã ghi trước đó rồi ném lỗi — không để lại file
 * mồ côi.
 */
export async function saveHandoverPhotoFiles(buffers: Buffer[]): Promise<SavedPhotoFile[]> {
  if (buffers.length === 0) return [];

  const now = new Date();
  const subDir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const absoluteDir = path.join(HANDOVER_UPLOAD_DIR, subDir);

  await fs.mkdir(absoluteDir, { recursive: true, mode: 0o755 });

  const saved: SavedPhotoFile[] = [];

  try {
    for (const buffer of buffers) {
      const fileName = `${subDir}/${randomUUID()}.jpg`;
      // "wx": không bao giờ ghi đè file có sẵn. 0o644 để script backup chạy
      // bằng user khác trên VPS (rsync về máy Mac) vẫn đọc được.
      await fs.writeFile(path.join(HANDOVER_UPLOAD_DIR, fileName), buffer, {
        flag: "wx",
        mode: 0o644,
      });
      saved.push({ fileName, sizeBytes: buffer.length });
    }
  } catch (error) {
    await removeHandoverPhotoFiles(saved.map((item) => item.fileName));
    throw error;
  }

  return saved;
}

export type TrySavePhotoResult =
  | { ok: true; saved: SavedPhotoFile[] }
  | { ok: false; error: string };

/**
 * Như saveHandoverPhotoFiles() nhưng KHÔNG ném lỗi — lỗi ghi đĩa (thư mục
 * uploads chưa tạo/sai quyền, hết dung lượng...) trả về thông báo rõ ràng cho
 * form thay vì trang lỗi trắng, và lượt bàn giao không bị ghi dở.
 */
export async function trySaveHandoverPhotoFiles(buffers: Buffer[]): Promise<TrySavePhotoResult> {
  try {
    return { ok: true, saved: await saveHandoverPhotoFiles(buffers) };
  } catch (error) {
    console.error("HANDOVER_PHOTO_SAVE_ERROR:", error);
    return {
      ok: false,
      error:
        "Không lưu được ảnh lên máy chủ (thư mục lưu ảnh lỗi hoặc đầy). Vui lòng báo Admin — hoặc bỏ ảnh ra để bàn giao trước, bổ sung ảnh sau.",
    };
  }
}

export function resolveHandoverPhotoPath(fileName: string): string {
  // Regex chỉ cho đúng dạng "YYYY/MM/<uuid>.jpg" — không có "..", không bắt
  // đầu bằng "/", nên path.join không thể thoát ra ngoài HANDOVER_UPLOAD_DIR.
  if (!HANDOVER_PHOTO_FILENAME_RE.test(fileName)) {
    throw new Error("Tên file ảnh không hợp lệ.");
  }

  return path.join(HANDOVER_UPLOAD_DIR, fileName);
}

/** Xoá file trên đĩa — bỏ qua file không tồn tại/tên không hợp lệ, không ném lỗi. */
export async function removeHandoverPhotoFiles(fileNames: string[]) {
  for (const fileName of fileNames) {
    try {
      await fs.unlink(resolveHandoverPhotoPath(fileName));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.error("HANDOVER_PHOTO_UNLINK_ERROR:", fileName, error);
      }
    }
  }
}

/**
 * Xoá file thật chỉ khi không còn dòng AssetHistoryPhoto nào trỏ tới (cấp
 * hàng loạt dùng chung 1 file cho nhiều thiết bị). Gọi SAU khi đã xoá dòng DB.
 */
export async function removeHandoverPhotoFileIfUnreferenced(fileName: string) {
  const stillUsed = await prisma.assetHistoryPhoto.count({ where: { fileName } });
  if (stillUsed === 0) {
    await removeHandoverPhotoFiles([fileName]);
  }
}

/**
 * Các lượt bàn giao đang THIẾU ảnh (có hạn photoDueAt, chưa có ảnh nào), chỉ
 * tính lượt bàn giao GẦN NHẤT của thiết bị và thiết bị vẫn đang nằm trong tay
 * đúng nhân viên đã nhận — thiết bị đã thu hồi/đổi tay thì không còn nhắc.
 * warehouseIds=null nghĩa là không giới hạn kho (quy ước chung của hệ thống).
 */
export async function getPendingHandoverPhotos(warehouseIds?: number[] | null) {
  const candidates = await prisma.assetHistory.findMany({
    where: {
      action: HistoryAction.TRANSFER,
      photoDueAt: { not: null },
      photos: { none: {} },
      asset: {
        currentEmployeeId: { not: null },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
    },
    include: {
      asset: {
        include: { model: true, warehouse: true, currentEmployee: true },
      },
    },
    orderBy: { photoDueAt: "asc" },
  });

  if (candidates.length === 0) return [];

  // Lượt bàn giao (TRANSFER) mới nhất của từng thiết bị — loại các lượt cũ
  // (VD: bàn giao A -> thu hồi -> bàn giao lại A có ảnh, lượt đầu không còn
  // ý nghĩa nhắc bổ sung).
  const latest = await prisma.assetHistory.groupBy({
    by: ["assetId"],
    where: {
      action: HistoryAction.TRANSFER,
      assetId: { in: Array.from(new Set(candidates.map((c) => c.assetId))) },
    },
    _max: { id: true },
  });
  const latestIdByAsset = new Map(latest.map((row) => [row.assetId, row._max.id]));

  const now = new Date();

  return candidates
    .filter(
      (history) =>
        latestIdByAsset.get(history.assetId) === history.id &&
        history.asset.currentEmployeeId === history.toEmployeeId
    )
    .map((history) => ({
      historyId: history.id,
      handedOverAt: history.createdAt,
      photoDueAt: history.photoDueAt as Date,
      createdBy: history.createdBy,
      asset: history.asset,
      status: getHandoverPhotoStatus(history.photoDueAt, 0, now),
    }));
}

type PendingHandoverPhoto = Awaited<ReturnType<typeof getPendingHandoverPhotos>>[number];

/**
 * Gom các lượt bàn giao thiếu ảnh theo NHÂN VIÊN đang giữ thiết bị — thường
 * 1 người nhận nhiều máy cùng lúc và chỉ chụp 1 biên bản cho cả lô, nên nhắc
 * + bổ sung theo người cho gọn. Nhóm có thiết bị quá hạn lên trước, rồi tới
 * hạn gần nhất.
 */
export async function getPendingHandoverPhotosByEmployee(warehouseIds?: number[] | null) {
  const items = await getPendingHandoverPhotos(warehouseIds);
  const groups = new Map<
    number,
    {
      employee: NonNullable<PendingHandoverPhoto["asset"]["currentEmployee"]>;
      items: PendingHandoverPhoto[];
    }
  >();

  for (const item of items) {
    const employee = item.asset.currentEmployee;
    if (!employee) continue;
    const group = groups.get(employee.id) ?? { employee, items: [] };
    group.items.push(item);
    groups.set(employee.id, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const overdueCount = group.items.filter((i) => i.status.kind === "overdue").length;
      // items đã sắp theo photoDueAt tăng dần -> phần tử đầu là hạn gần nhất.
      const earliest = group.items[0];
      return {
        employee: group.employee,
        items: group.items,
        overdueCount,
        earliestDueAt: earliest.photoDueAt,
        earliestStatus: earliest.status,
      };
    })
    .sort((a, b) => {
      if ((b.overdueCount > 0 ? 1 : 0) !== (a.overdueCount > 0 ? 1 : 0)) {
        return (b.overdueCount > 0 ? 1 : 0) - (a.overdueCount > 0 ? 1 : 0);
      }
      return a.earliestDueAt.getTime() - b.earliestDueAt.getTime();
    });
}

/**
 * Số NHÂN VIÊN có ít nhất 1 thiết bị đã QUÁ HẠN bổ sung ảnh bàn giao — dùng
 * cho banner ở AppLayout.
 */
export async function countEmployeesWithOverdueHandoverPhotos(warehouseIds?: number[] | null) {
  const pending = await getPendingHandoverPhotos(warehouseIds);
  const employeeIds = new Set(
    pending
      .filter((item) => item.status.kind === "overdue")
      .map((item) => item.asset.currentEmployeeId)
  );
  return employeeIds.size;
}
