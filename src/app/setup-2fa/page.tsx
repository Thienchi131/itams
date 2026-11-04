import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { generateTwoFactorSecret, getOtpAuthUri } from "@/lib/totp";
import { logoutAction } from "@/app/logout/actions";
import { confirmTwoFactorSetupAction } from "./actions";
import SetupTwoFactorForm from "./SetupTwoFactorForm";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Mã không đúng hoặc đã hết hạn — thử lại với mã mới nhất trên app.",
  missing_code: "Vui lòng nhập đủ 6 số.",
};

export default async function SetupTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // skip2FACheck: đây chính là trang xử lý bước bắt buộc bật 2FA, không được
  // tự redirect lại chính nó (giống cách /change-password dùng skipPasswordCheck).
  const user = await requireLogin({ skip2FACheck: true });
  const { error } = await searchParams;

  if (user.twoFactorEnabled) {
    redirect(user.twoFactorVerified ? getDefaultRouteForRole(user.role.name) : "/verify-2fa");
  }

  // Tái sử dụng secret cũ nếu trang bị tải lại giữa chừng (vd nhập sai mã) —
  // không sinh secret mới mỗi lần render, tránh mã vừa quét trên app bị lệch
  // với secret mới trong DB.
  let secret = user.twoFactorSecret;

  if (!secret) {
    secret = generateTwoFactorSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });
  }

  const otpauthUri = getOtpAuthUri(secret, user.username);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Thiết lập xác thực 2 lớp
        </h1>
        <p className="mt-2 text-slate-500">
          Tài khoản <span className="font-semibold">{user.fullName}</span> bắt
          buộc phải bật xác thực 2 lớp (Google Authenticator hoặc app tương
          thích) trước khi sử dụng hệ thống.
        </p>

        {error && ERROR_MESSAGES[error] && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        <SetupTwoFactorForm
          otpauthUri={otpauthUri}
          secret={secret}
          confirmAction={confirmTwoFactorSetupAction}
        />

        <form action={logoutAction} className="mt-6 text-center">
          <button className="text-sm font-medium text-slate-500 hover:text-blue-600">
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
