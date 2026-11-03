"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin, upgradeSessionTo2FAVerified } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { verifyTwoFactorCode } from "@/lib/totp";
import { isRateLimited } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;

export async function confirmTwoFactorSetupAction(formData: FormData) {
  const user = await requireLogin({ skip2FACheck: true });

  if (user.twoFactorEnabled) {
    redirect(user.twoFactorVerified ? getDefaultRouteForRole(user.role.name) : "/verify-2fa");
  }

  const code = String(formData.get("code") || "").trim();

  if (!code) {
    redirect("/setup-2fa?error=missing_code");
  }

  if (isRateLimited(`2fa-setup:${user.id}`, MAX_ATTEMPTS, WINDOW_MS)) {
    redirect("/setup-2fa?error=invalid_code");
  }

  if (!user.twoFactorSecret) {
    redirect("/setup-2fa");
  }

  const isValid = verifyTwoFactorCode(user.twoFactorSecret, code);

  if (!isValid) {
    redirect("/setup-2fa?error=invalid_code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  });

  await upgradeSessionTo2FAVerified(user.id);

  redirect(getDefaultRouteForRole(user.role.name));
}
