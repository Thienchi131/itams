"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { generateRandomPassword } from "@/lib/password";
import { sendUserPasswordEmail } from "@/lib/mail";
import { requireRole } from "@/modules/auth/auth.service";
import { createAuditLog } from "@/modules/audit/audit-log.service";

// error: lỗi, hiện trong modal. success: xong, modal tự đóng + hiện toast.
// notice: xong nhưng có điều Admin PHẢI đọc (VD mật khẩu tạm khi gửi mail
// thất bại) — modal giữ nguyên để hiện nội dung.
export type UserActionState =
  | { error: string }
  | { success: string }
  | { notice: string; secret?: string }
  | null;

export async function resetUserPasswordAction(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const currentUser = await requireRole(["Admin"]);

  const userId = Number(formData.get("userId"));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    return { error: "Không tìm thấy user" };
  }

  const newPassword = generateRandomPassword(12);
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      // Đây là action "Reset" thật sự dùng ở danh sách Users (tự sinh
      // password + gửi email) — phải bật cờ để user bắt buộc đổi lại ở lần
      // đăng nhập kế tiếp, giống như flow đổi password thủ công.
      mustChangePassword: true,
    },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Reset mật khẩu",
    targetType: "User",
    targetId: user.id,
    detail: `${user.fullName} (${user.username})`,
  });

  revalidatePath("/users");

  // Await để biết email có tới không (transporter có timeout 10s). Trước đây
  // gửi kiểu "bắn rồi quên": SMTP lỗi thì modal vẫn đóng như thành công,
  // user bị đổi mật khẩu mà không ai biết mật khẩu mới.
  try {
    await sendUserPasswordEmail({
      to: user.username,
      fullName: user.fullName,
      password: newPassword,
    });
  } catch (error) {
    console.error("SEND_EMAIL_ERROR:", error);
    return {
      notice: `Đã đặt lại mật khẩu cho ${user.fullName} nhưng gửi email thất bại. Hãy chuyển mật khẩu tạm dưới đây cho người dùng qua kênh an toàn (chỉ hiện 1 lần):`,
      secret: newPassword,
    };
  }

  return { success: `Đã đặt lại mật khẩu và gửi email cho ${user.fullName}.` };
}

// Escape hatch cho Admin khi user mất điện thoại/đổi máy nên không còn truy
// cập được app authenticator cũ — không có gì để "khôi phục" (secret cũ chỉ
// mình họ có), nên xử lý bằng cách tắt 2FA hẳn, buộc thiết lập lại từ đầu ở
// lần đăng nhập kế tiếp (giống hệt cơ chế mustChangePassword).
export async function resetUserTwoFactorAction(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const currentUser = await requireRole(["Admin"]);

  const userId = Number(formData.get("userId"));

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { error: "Không tìm thấy user" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Reset 2FA",
    targetType: "User",
    targetId: user.id,
    detail: `${user.fullName} (${user.username})`,
  });

  revalidatePath("/users");
  return { success: `Đã reset 2FA cho ${user.fullName}. Người dùng sẽ thiết lập lại ở lần đăng nhập tới.` };
}

export async function deleteUserAction(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const currentUser = await requireRole(["Admin"]);
  const userId = Number(formData.get("userId"));

  if (currentUser.id === userId) {
    return { error: "Không thể xoá tài khoản đang đăng nhập" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    return { error: "Không tìm thấy user" };
  }

  if (user.role.name === "Admin") {
    const adminCount = await prisma.user.count({
      where: {
        role: {
          name: "Admin",
        },
      },
    });

    if (adminCount <= 1) {
      return { error: "Không thể xoá Admin cuối cùng" };
    }
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá tài khoản",
    targetType: "User",
    targetId: userId,
    detail: `${user.fullName} (${user.username})`,
  });

  revalidatePath("/users");
  return { success: `Đã xoá tài khoản ${user.fullName}.` };
}