"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/modules/audit/audit-log.service";

const REQUIRE_ROLES = ["Admin"];

export async function setImportEnabledAction(formData: FormData) {
  const currentUser = await requireRole(REQUIRE_ROLES);

  const enabled = formData.get("enabled") === "true";

  await prisma.importSettings.upsert({
    where: { id: 1 },
    create: { id: 1, enabled, updatedBy: currentUser.fullName },
    update: { enabled, updatedBy: currentUser.fullName },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: enabled ? "Bật Import Excel" : "Tắt Import Excel",
    targetType: "ImportSettings",
  });

  redirect(`/settings/import?success=${enabled ? "enabled" : "disabled"}`);
}
