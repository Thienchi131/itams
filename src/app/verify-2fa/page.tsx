import { redirect } from "next/navigation";
import { requireLogin, getOwnTwoFactorSecret } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { logoutAction } from "@/app/logout/actions";
import VerifyTwoFactorForm from "./VerifyTwoFactorForm";
import { YubikeyLoginButton } from "../security/YubikeyButtons";
import { countUserYubikeys } from "@/modules/auth/yubikey-otp.service";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Mã không đúng hoặc đã hết hạn — thử lại với mã mới nhất trên app.",
  missing_code: "Vui lòng nhập đủ 6 số.",
  rate_limited: "Nhập sai quá nhiều lần — vui lòng thử lại sau vài phút.",
  no_totp: "Tài khoản này không dùng app Authenticator — hãy dùng YubiKey.",
};

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // skip2FACheck: đây chính là trang xử lý bước xác thực 2FA, không được tự
  // redirect lại chính nó.
  const user = await requireLogin({ skip2FACheck: true });
  const { error } = await searchParams;

  if (!user.twoFactorEnabled) {
    redirect("/setup-2fa");
  }

  if (user.twoFactorVerified) {
    redirect(getDefaultRouteForRole(user.role.name));
  }

  // Chọn 1 trong 2 cách: chạm YubiKey (nếu đã đăng ký key) hoặc nhập mã app
  // Authenticator (nếu đang bật).
  const keyCount = await countUserYubikeys(user.id);
  const hasKey = keyCount > 0;
  const hasTotp = user.totpEnabled && !!(await getOwnTwoFactorSecret(user.id));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Xác thực 2 lớp</h1>
        <p className="mt-2 text-slate-500">
          {hasKey
              ? "Cắm YubiKey đã đăng ký rồi chạm vào nút trên key"
              : "Nhập mã 6 số hiện trên app Google Authenticator"}{" "}
          của <span className="font-semibold">{user.fullName}</span>.
        </p>

        {error && ERROR_MESSAGES[error] && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        {hasKey && (
          <div className="mt-6">
            <YubikeyLoginButton />
          </div>
        )}

        {/* YubiKey là cách chính; mã app Authenticator chỉ là dự phòng (thu
            gọn, mở ra khi quên/mất key). Tài khoản cũ chưa có key thì nhập
            mã như trước, sau đó bị bắt đăng ký key (/register-key). */}
        {hasKey && hasTotp && (
          <details className="group mt-6 overflow-hidden rounded-xl border border-slate-200">
            {/* Padding đặt trên <summary> để bấm vào BẤT KỲ chỗ nào trong khung
                đều mở/đóng được, không chỉ bấm đúng dòng chữ. */}
            <summary className="block cursor-pointer select-none p-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="mr-2 inline-block text-xs text-slate-400 transition group-open:rotate-90">▶</span>
              Dùng Authenticator code
            </summary>
            <div className="px-4 pb-4">
              <VerifyTwoFactorForm autoFocus={false} />
            </div>
          </details>
        )}

        {!hasKey && hasTotp && <VerifyTwoFactorForm autoFocus />}

        {!hasKey && !hasTotp && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Tài khoản chưa có cách xác thực 2 lớp nào dùng được — liên hệ Admin để reset 2FA.
          </p>
        )}

        <form action={logoutAction} className="mt-6 text-center">
          <button className="text-sm font-medium text-slate-500 hover:text-blue-600">
            Không phải bạn? Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
