"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { hashResetToken } from "@/lib/reset-token";

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!token) {
    redirect("/forgot-password?error=invalid_token");
  }

  if (newPassword.length < 8) {
    redirect(`/reset-password?token=${token}&error=length`);
  }

  if (newPassword !== confirmPassword) {
    redirect(`/reset-password?token=${token}&error=mismatch`);
  }

  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  // Không tách riêng thông báo "token sai" / "token hết hạn" / "token đã
  // dùng" — gộp chung để không lộ thông tin thừa, và vì hành động khắc phục
  // với cả 3 trường hợp là như nhau: xin gửi lại link mới.
  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date()
  ) {
    redirect("/forgot-password?error=expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        password: hashedPassword,
        // Đã tự đặt mật khẩu mới theo ý mình (không phải mật khẩu tạm do
        // Admin/hệ thống sinh ra) nên không cần ép đổi lại lần nữa.
        mustChangePassword: false,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login?reset=success");
}
