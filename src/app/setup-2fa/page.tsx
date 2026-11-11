import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireLogin, getOwnTwoFactorSecret } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { generateTwoFactorSecret, getOtpAuthUri } from "@/lib/totp";
import { logoutAction } from "@/app/logout/actions";
import { confirmTwoFactorSetupAction } from "./actions";
import SetupTwoFactorForm from "./SetupTwoFactorForm";
import { RegisterYubikeyButton } from "../security/YubikeyButtons";
import { isSecurityKeyRequired } from "@/modules/auth/security-key-policy";

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

  // Trang này chỉ dành cho thiết lập 2FA lần đầu (user không tự đổi cách
  // 2FA sau đó — Admin reset ở trang Tài khoản).
  if (user.twoFactorEnabled) {
    redirect(user.twoFactorVerified ? getDefaultRouteForRole(user.role.name) : "/verify-2fa");
  }

  // YubiKey bắt buộc -> thiết lập lần đầu CHỈ cho đăng ký key. Tắt bắt buộc
  // (REQUIRE_SECURITY_KEY=false) -> cho chọn YubiKey hoặc app Authenticator.
  const keyRequired = isSecurityKeyRequired();
  const showTotp = !keyRequired;

  // Tái sử dụng secret cũ nếu trang bị tải lại giữa chừng (vd nhập sai mã) —
  // không sinh secret mới mỗi lần render, tránh mã vừa quét trên app bị lệch
  // với secret mới trong DB.
  let secret = await getOwnTwoFactorSecret(user.id);

  if (!secret && showTotp) {
    secret = generateTwoFactorSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });
  }

  const otpauthUri = secret ? getOtpAuthUri(secret, user.username) : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Thiết lập xác thực 2 lớp
        </h1>
        <p className="mt-2 text-slate-500">
          {keyRequired ? (
            <>
              Tài khoản <span className="font-semibold">{user.fullName}</span> bắt
              buộc phải đăng ký <span className="font-semibold">YubiKey</span> làm xác thực 2 lớp
              trước khi sử dụng hệ thống. 
            </>
          ) : (
            <>
              Tài khoản <span className="font-semibold">{user.fullName}</span> bắt
              buộc phải bật xác thực 2 lớp trước khi sử dụng hệ thống — chọn{" "}
              <span className="font-semibold">YubiKey</span> hoặc{" "}
              <span className="font-semibold">app Authenticator</span>.
            </>
          )}
        </p>

        {error && ERROR_MESSAGES[error] && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="font-semibold text-slate-900">
              {keyRequired ? "Khoá bảo mật YubiKey" : "Cách 1: Khoá bảo mật YubiKey"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Mỗi lần đăng nhập chỉ cần cắm key và chạm nút trên key, không phải gõ mã.
              Mỗi tài khoản 1 key — muốn đổi key thì báo Admin.
            </p>
            <div className="mt-4">
              <RegisterYubikeyButton mode="setup" />
            </div>
        </div>

        {showTotp && (
          <h2 className="mt-8 font-semibold text-slate-900">Cách 2: App Authenticator trên điện thoại</h2>
        )}

        {showTotp && secret && (
          <SetupTwoFactorForm
            otpauthUri={otpauthUri}
            secret={secret}
            confirmAction={confirmTwoFactorSetupAction}
          />
        )}

        <form action={logoutAction} className="mt-6 text-center">
          <button className="text-sm font-medium text-slate-500 hover:text-blue-600">
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
