"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

export async function changeOwnPasswordAction(formData: FormData) {
  // skipPasswordCheck: đây chính là trang xử lý việc đổi mật khẩu, nên không
  // được tự redirect lại chính nó.
  const user = await requireLogin({ skipPasswordCheck: true });

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  // Lấy hash mật khẩu riêng (getCurrentUser đã omit password để không chảy
  // ra mọi trang) — chỉ nạp đúng lúc cần kiểm tra mật khẩu hiện tại.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  const isCurrentValid =
    !!row && (await verifyPassword(currentPassword, row.password)).valid;

  if (!isCurrentValid) {
    redirect("/change-password?error=current");
  }

  if (newPassword.length < 8) {
    redirect("/change-password?error=length");
  }

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=mismatch");
  }

  if (currentPassword === newPassword) {
    redirect("/change-password?error=same");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  redirect(withFlash(getDefaultRouteForRole(user.role.name), "own_password_changed"));
}
