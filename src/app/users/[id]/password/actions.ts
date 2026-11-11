"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password-hash";
import { withFlash } from "@/lib/flash";

export type ChangePasswordState = { error: string } | null;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  await requireRole(["Admin"]);

  const id = Number(formData.get("id"));
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password.length < 8) {
    return { error: "Password phải có ít nhất 8 ký tự" };
  }

  if (password !== confirmPassword) {
    return { error: "Password nhập lại không khớp" };
  }

  const hashedPassword = await hashPassword(password);

  await prisma.user.update({
    where: { id },
    data: {
      password: hashedPassword,
      // Admin vừa đặt lại mật khẩu tạm thời -> bắt user tự đổi lại ở lần
      // đăng nhập kế tiếp.
      mustChangePassword: true,
    },
  });

  redirect(withFlash(`/users/${id}`, "user_password_changed"));
}