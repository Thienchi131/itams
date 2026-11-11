"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password-hash";
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
  const hashedPassword = await hashPassword(newPassword);

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

// Escape hatch cho Admin — tách 2 nút riêng (user KHÔNG tự quản lý được):
// - Reset YubiKey: xoá key đang gắn (mất key / đổi sang key khác; mỗi tài
//   khoản chỉ 1 key). Nếu user còn app
//   Authenticator thì đăng nhập bằng mã app rồi bị bắt đăng ký key mới.
// - Reset app Authenticator: tắt mã app (VD mất/đổi điện thoại). Nếu user
//   còn key thì vẫn đăng nhập bằng key.
// Hết cả 2 cách -> twoFactorEnabled = false, lần đăng nhập tới thiết lập lại
// từ đầu (giống cơ chế mustChangePassword).
export async function resetUserSecurityKeysAction(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const currentUser = await requireRole(["Admin"]);
  const userId = Number(formData.get("userId"));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Không tìm thấy user" };

  const removedKeys = await prisma.$transaction(async (tx) => {
    const { count } = await tx.yubikeyOtpDevice.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: user.totpEnabled },
    });
    return count;
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Reset YubiKey",
    targetType: "User",
    targetId: user.id,
    detail: `${user.fullName} (${user.username}) — xoá ${removedKeys} YubiKey`,
  });

  revalidatePath("/users");
  return {
    success: user.totpEnabled
      ? `Đã xoá YubiKey của ${user.fullName}. Họ đăng nhập bằng mã app Authenticator rồi đăng ký key mới.`
      : `Đã xoá YubiKey của ${user.fullName}. Lần đăng nhập tới họ sẽ đăng ký lại YubiKey từ đầu.`,
  };
}

export async function resetUserAuthenticatorAction(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const currentUser = await requireRole(["Admin"]);
  const userId = Number(formData.get("userId"));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { yubikey: { select: { id: true } } },
  });
  if (!user) return { error: "Không tìm thấy user" };

  const hasKey = !!user.yubikey;

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: false, twoFactorSecret: null, twoFactorEnabled: hasKey },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Reset app Authenticator",
    targetType: "User",
    targetId: user.id,
    detail: `${user.fullName} (${user.username})`,
  });

  revalidatePath("/users");
  return {
    success: hasKey
      ? `Đã tắt app Authenticator của ${user.fullName}. Họ vẫn đăng nhập bằng YubiKey.`
      : `Đã tắt app Authenticator của ${user.fullName}. Lần đăng nhập tới họ sẽ thiết lập lại 2FA từ đầu.`,
  };
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