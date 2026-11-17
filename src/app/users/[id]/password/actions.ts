"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, verifyOwnPassword } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password-hash";
import { validatePassword } from "@/lib/password-policy";
import { withFlash } from "@/lib/flash";

export type ChangePasswordState = { error: string } | null;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const admin = await requireRole(["Admin"]);

  const id = Number(formData.get("id"));
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const adminPassword = String(formData.get("adminPassword") || "");

  // Step-up: Admin phải nhập lại mật khẩu của CHÍNH MÌNH trước khi đặt lại
  // mật khẩu cho người khác (chặn lạm dụng phiên Admin đang mở).
  if (!(await verifyOwnPassword(admin.id, adminPassword))) {
    return { error: "Mật khẩu xác nhận của bạn không đúng." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
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
      // Giết sạch phiên đang mở của user bị reset (xem session.ts).
      passwordChangedAt: new Date(),
    },
  });

  redirect(withFlash(`/users/${id}`, "user_password_changed"));
}