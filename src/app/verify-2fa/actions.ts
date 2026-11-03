"use server";

import { requireLogin, upgradeSessionTo2FAVerified } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { verifyTwoFactorCode } from "@/lib/totp";
import { isRateLimited } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

// Mã TOTP 6 số chỉ có 1 triệu khả năng — không chặn brute-force ở đây thì
// coi như không có 2FA. Ngưỡng chặt hơn hẳn login (5/5 phút) vì đây là bước
// cuối cùng trước khi vào hệ thống.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;

export async function verifyTwoFactorAction(formData: FormData) {
  const user = await requireLogin({ skip2FACheck: true });

  if (!user.twoFactorEnabled) {
    redirect("/setup-2fa");
  }

  if (user.twoFactorVerified) {
    redirect(getDefaultRouteForRole(user.role.name));
  }

  const code = String(formData.get("code") || "").trim();

  if (!code) {
    redirect("/verify-2fa?error=missing_code");
  }

  if (isRateLimited(`2fa-verify:${user.id}`, MAX_ATTEMPTS, WINDOW_MS)) {
    redirect("/verify-2fa?error=rate_limited");
  }

  if (!user.twoFactorSecret) {
    redirect("/setup-2fa");
  }

  const isValid = verifyTwoFactorCode(user.twoFactorSecret, code);

  if (!isValid) {
    redirect("/verify-2fa?error=invalid_code");
  }

  await upgradeSessionTo2FAVerified(user.id);

  redirect(getDefaultRouteForRole(user.role.name));
}
