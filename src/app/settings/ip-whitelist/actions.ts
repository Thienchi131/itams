"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { isValidWhitelistEntry } from "@/lib/ip-whitelist";
import { createAuditLog } from "@/modules/audit/audit-log.service";

// Bật/tắt + sửa danh sách whitelist IP ảnh hưởng khả năng truy cập của
// TOÀN BỘ hệ thống (kể cả chính Admin) — chỉ Admin được làm.
const REQUIRE_ROLES = ["Admin"];

export async function createEntryAction(formData: FormData) {
  const currentUser = await requireRole(REQUIRE_ROLES);

  const cidr = String(formData.get("cidr") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;

  const { valid, error } = isValidWhitelistEntry(cidr);

  if (!valid) {
    redirect(`/settings/ip-whitelist?error=${encodeURIComponent(error || "IP không hợp lệ.")}`);
  }

  const existed = await prisma.ipWhitelistEntry.findUnique({ where: { cidr } });

  if (existed) {
    redirect(
      `/settings/ip-whitelist?error=${encodeURIComponent("IP/dải này đã có trong danh sách.")}`
    );
  }

  await prisma.ipWhitelistEntry.create({
    data: { cidr, description, createdBy: currentUser.fullName },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Thêm IP whitelist",
    targetType: "IpWhitelistEntry",
    detail: description ? `${cidr} (${description})` : cidr,
  });

  redirect("/settings/ip-whitelist?success=created");
}

export async function deleteEntryAction(formData: FormData) {
  const currentUser = await requireRole(REQUIRE_ROLES);

  const id = Number(formData.get("id"));

  const entry = await prisma.ipWhitelistEntry.findUnique({ where: { id } });

  await prisma.ipWhitelistEntry.delete({ where: { id } });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá IP whitelist",
    targetType: "IpWhitelistEntry",
    targetId: id,
    detail: entry?.cidr ?? null,
  });

  redirect("/settings/ip-whitelist?success=deleted");
}

export async function setWhitelistEnabledAction(formData: FormData) {
  const currentUser = await requireRole(REQUIRE_ROLES);

  const enabled = formData.get("enabled") === "true";

  // Chặn bật whitelist khi danh sách đang trống — bật trong trường hợp đó
  // chắc chắn tự khoá TẤT CẢ mọi người (kể cả Admin) ra khỏi hệ thống ngay
  // lập tức, vì không có IP nào khớp cả.
  if (enabled) {
    const count = await prisma.ipWhitelistEntry.count();

    if (count === 0) {
      redirect(
        `/settings/ip-whitelist?error=${encodeURIComponent(
          "Chưa có IP nào trong danh sách — thêm ít nhất IP của chính bạn trước khi bật."
        )}`
      );
    }
  }

  await prisma.ipWhitelistConfig.upsert({
    where: { id: 1 },
    create: { id: 1, enabled, updatedBy: currentUser.fullName },
    update: { enabled, updatedBy: currentUser.fullName },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: enabled ? "Bật whitelist IP" : "Tắt whitelist IP",
    targetType: "IpWhitelistConfig",
  });

  redirect(`/settings/ip-whitelist?success=${enabled ? "enabled" : "disabled"}`);
}
