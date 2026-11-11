"use server";

import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { requireLogin, upgradeSessionTo2FAVerified } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import { registerYubikeyForUser, verifyYubikeyLogin } from "@/modules/auth/yubikey-otp.service";

export type YubikeyActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string; redirectTo?: string };

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000;

// Mỗi tài khoản đúng 1 YubiKey, user KHÔNG tự thêm/đổi/xoá — đổi key thì
// Admin xoá key cũ ở trang Tài khoản, lần đăng nhập sau user đăng ký key mới.
// Chỉ đăng ký được khi: đang THIẾT LẬP 2FA lần đầu, hoặc đã qua 2FA (bằng mã
// app dự phòng) mà chưa có key. Phiên mới nhập mật khẩu mà CHƯA qua 2FA thì
// không được gắn key (chống người biết mật khẩu gắn key của họ vào).
export async function registerYubikeyAction(otp: string): Promise<YubikeyActionResult> {
  const user = await requireLogin({ skip2FACheck: true });
  if (user.twoFactorEnabled && !user.twoFactorVerified) {
    return { ok: false, error: "Hãy xác thực 2 lớp trước khi thêm YubiKey.", redirectTo: "/verify-2fa" };
  }
  if (user.yubikey) {
    return { ok: false, error: "Tài khoản đã có YubiKey. Muốn đổi key, báo Admin xoá key cũ." };
  }
  if (isRateLimited(`yubikey-reg:${user.id}`, MAX_ATTEMPTS, WINDOW_MS)) {
    return { ok: false, error: "Thử quá nhiều lần — vui lòng chờ vài phút." };
  }

  const result = await registerYubikeyForUser(user.id, otp);
  if (!result.ok) return result;

  await createAuditLog({
    actorName: user.fullName,
    action: "Đăng ký YubiKey",
    targetType: "User",
    targetId: user.id,
    detail: `${result.name} — ${user.username}`,
  });

  // Thiết lập 2FA lần đầu bằng key -> bật 2FA + phiên này coi như đã xác thực.
  if (!user.twoFactorEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await upgradeSessionTo2FAVerified(user.id);
    return { ok: true, message: `Đã đăng ký ${result.name}.`, redirectTo: getDefaultRouteForRole(user.role.name) };
  }

  // Vừa bị bắt đăng ký ở /register-key -> vào hệ thống.
  return { ok: true, message: `Đã đăng ký ${result.name}.`, redirectTo: getDefaultRouteForRole(user.role.name) };
}

export async function loginWithYubikeyAction(otp: string): Promise<YubikeyActionResult> {
  const user = await requireLogin({ skip2FACheck: true });
  if (!user.twoFactorEnabled) return { ok: false, error: "Chưa thiết lập 2FA.", redirectTo: "/setup-2fa" };
  if (user.twoFactorVerified) return { ok: true, redirectTo: getDefaultRouteForRole(user.role.name) };

  if (isRateLimited(`2fa-key:${user.id}`, MAX_ATTEMPTS, WINDOW_MS)) {
    return { ok: false, error: "Thử quá nhiều lần — vui lòng chờ vài phút." };
  }

  const result = await verifyYubikeyLogin(user.id, otp);
  if (!result.ok) return result;

  await upgradeSessionTo2FAVerified(user.id);
  return { ok: true, message: "Xác minh thành công.", redirectTo: getDefaultRouteForRole(user.role.name) };
}
