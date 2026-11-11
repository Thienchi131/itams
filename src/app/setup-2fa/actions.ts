"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin, upgradeSessionTo2FAVerified, getOwnTwoFactorSecret } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { verifyTwoFactorCode } from "@/lib/totp";
import { isRateLimited } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { isSecurityKeyRequired } from "@/modules/auth/security-key-policy";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;

export async function confirmTwoFactorSetupAction(formData: FormData) {
  const user = await requireLogin({ skip2FACheck: true });

  // Chỉ dùng cho thiết lập 2FA lần đầu (user không tự thêm/đổi cách 2FA).
  const base = "/setup-2fa?";

  if (user.twoFactorEnabled) {
    redirect(user.twoFactorVerified ? getDefaultRouteForRole(user.role.name) : "/verify-2fa");
  }

  // YubiKey bắt buộc: lần đầu phải đăng ký key, không thiết lập bằng app.
  if (isSecurityKeyRequired()) {
    redirect("/setup-2fa");
  }

  const code = String(formData.get("code") || "").trim();

  if (!code) {
    redirect(`${base}error=missing_code`);
  }

  if (isRateLimited(`2fa-setup:${user.id}`, MAX_ATTEMPTS, WINDOW_MS)) {
    redirect(`${base}error=invalid_code`);
  }

  const secret = await getOwnTwoFactorSecret(user.id);
  if (!secret) {
    redirect(base.slice(0, -1));
  }

  const isValid = verifyTwoFactorCode(secret, code);

  if (!isValid) {
    redirect(`${base}error=invalid_code`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, totpEnabled: true },
  });

  await upgradeSessionTo2FAVerified(user.id);

  redirect(getDefaultRouteForRole(user.role.name));
}
