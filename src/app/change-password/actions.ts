"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

export async function changeOwnPasswordAction(formData: FormData) {
  // skipPasswordCheck: đây chính là trang xử lý việc đổi mật khẩu, nên không
  // được tự redirect lại chính nó.
  const user = await requireLogin({ skipPasswordCheck: true });

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const isCurrentValid = await bcrypt.compare(currentPassword, user.password);

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

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  redirect(withFlash(getDefaultRouteForRole(user.role.name), "own_password_changed"));
}
