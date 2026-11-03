"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import { revalidatePath } from "next/cache";
import { AssetModelTag } from "@prisma/client";

function parseModelTag(value: FormDataEntryValue | null): AssetModelTag | null {
  return value === "OK" || value === "BACKUP" ? value : null;
}

// Cập nhật tag của 1 Model — gọi trực tiếp qua <form action={...}> ở
// ModelTagRow.tsx, tự submit mỗi khi đổi lựa chọn trong dropdown, KHÔNG
// redirect (khác các action khác trong Cài đặt) để giữ nguyên vị trí cuộn
// của bảng — danh sách model có thể dài, redirect về đầu trang sau mỗi lần
// đổi 1 dòng sẽ rất khó chịu khi gán tag cho nhiều model liên tiếp.
// revalidatePath cả 2 trang: chính trang này (để select hiển thị đúng giá
// trị mới nếu load lại) và /assets (nơi tag này thực sự hiển thị ra ở cột
// "Tag" của bảng Quản lý tài sản).
export async function updateModelTagAction(formData: FormData) {
  const currentUser = await requireRole([ROLE_ADMIN]);

  const id = Number(formData.get("id"));
  // "" (chọn "— Không gắn —") parse ra null — đây là lựa chọn HỢP LỆ để bỏ
  // tag đã gắn trước đó, không phải lỗi input.
  const tag = parseModelTag(formData.get("tag"));

  if (!Number.isInteger(id) || id <= 0) {
    return;
  }

  const model = await prisma.assetModel.findUnique({ where: { id } });

  if (!model) {
    return;
  }

  // Không có gì đổi (VD người dùng bấm lại đúng giá trị cũ) — bỏ qua, khỏi
  // tạo audit log rác.
  if (model.tag === tag) {
    return;
  }

  await prisma.assetModel.update({
    where: { id },
    data: { tag },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Gắn tag Model",
    targetType: "AssetModel",
    targetId: id,
    detail: `${model.modelCode ?? model.modelName} — ${
      tag ? `${tag === "OK" ? "🆗 Cấp phát được" : "🅱️ Backup"}` : "bỏ tag"
    }`,
  });

  revalidatePath("/settings/model-tags");
  revalidatePath("/assets");
}
