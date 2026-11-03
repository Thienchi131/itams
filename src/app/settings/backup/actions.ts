"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { requireRole } from "@/modules/auth/auth.service";
import {
  createBackup,
  deleteBackup,
  restoreFromFile,
  resolveBackupPath,
} from "@/modules/backup/backup.service";

export type BackupActionState = { error: string } | null;

// Chuỗi bắt buộc gõ đúng (không phân biệt hoa/thường, tự trim khoảng trắng)
// trước khi cho phép khôi phục — lớp phòng thủ cuối cùng chống bấm nhầm cho
// 1 thao tác không thể hoàn tác (ghi đè toàn bộ dữ liệu hiện tại).
const RESTORE_CONFIRM_PHRASE = "KHOI PHUC";

function checkConfirmPhrase(formData: FormData): string | null {
  const value = String(formData.get("confirmText") || "")
    .trim()
    .toUpperCase();

  if (value !== RESTORE_CONFIRM_PHRASE) {
    return `Vui lòng gõ đúng "${RESTORE_CONFIRM_PHRASE}" để xác nhận khôi phục.`;
  }

  return null;
}

export async function createBackupAction(
  _prevState: BackupActionState,
  _formData: FormData
): Promise<BackupActionState> {
  const currentUser = await requireRole(["Admin"]);

  try {
    await createBackup(currentUser.fullName);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Không tạo được backup.",
    };
  }

  revalidatePath("/settings/backup");
  redirect("/settings/backup?success=created");
}

export async function deleteBackupAction(
  _prevState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  const currentUser = await requireRole(["Admin"]);
  const name = String(formData.get("name") || "");

  try {
    await deleteBackup(name, currentUser.fullName);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Không xoá được file backup.",
    };
  }

  revalidatePath("/settings/backup");
  redirect("/settings/backup?success=deleted");
}

// Khôi phục từ 1 file backup ĐÃ CÓ SẴN trong danh sách trên server (do
// createBackupAction hoặc cron scripts/backup-db.sh tạo trước đó).
export async function restoreExistingAction(
  _prevState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  const currentUser = await requireRole(["Admin"]);

  const confirmError = checkConfirmPhrase(formData);
  if (confirmError) return { error: confirmError };

  const name = String(formData.get("name") || "");

  let filePath: string;
  try {
    filePath = resolveBackupPath(name);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "File backup không hợp lệ.",
    };
  }

  try {
    await restoreFromFile(filePath, currentUser.fullName, { originalName: name });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Khôi phục thất bại.",
    };
  }

  revalidatePath("/settings/backup");
  redirect("/settings/backup?success=restored");
}

// Khôi phục từ 1 file .sql.gz mới upload từ máy người dùng (VD: tải backup
// từ 1 VPS khác về rồi khôi phục lên đây, hoặc backup cũ tải thủ công trước
// khi có tính năng này).
export async function restoreUploadAction(
  _prevState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  const currentUser = await requireRole(["Admin"]);

  const confirmError = checkConfirmPhrase(formData);
  if (confirmError) return { error: confirmError };

  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Vui lòng chọn file backup (.sql.gz) để khôi phục." };
  }

  if (!file.name.toLowerCase().endsWith(".gz")) {
    return {
      error: "File phải là bản nén .sql.gz do chính tính năng Backup của hệ thống tạo ra.",
    };
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `itams-restore-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.sql.gz`
  );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);
    await restoreFromFile(tmpPath, currentUser.fullName, { originalName: file.name });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Khôi phục thất bại.",
    };
  } finally {
    await fs.rm(tmpPath, { force: true });
  }

  revalidatePath("/settings/backup");
  redirect("/settings/backup?success=restored");
}
