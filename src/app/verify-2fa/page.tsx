import { redirect } from "next/navigation";
import { requireLogin } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { logoutAction } from "@/app/logout/actions";
import VerifyTwoFactorForm from "./VerifyTwoFactorForm";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Mã không đúng hoặc đã hết hạn — thử lại với mã mới nhất trên app.",
  missing_code: "Vui lòng nhập đủ 6 số.",
  rate_limited: "Nhập sai quá nhiều lần — vui lòng thử lại sau vài phút.",
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Xác thực 2 lớp</h1>
        <p className="mt-2 text-slate-500">
          Nhập mã 6 số hiện trên app Google Authenticator của{" "}
          <span className="font-semibold">{user.fullName}</span>.
        </p>

        {error && ERROR_MESSAGES[error] && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        <VerifyTwoFactorForm />

        <form action={logoutAction} className="mt-6 text-center">
          <button className="text-sm font-medium text-slate-500 hover:text-blue-600">
            Không phải bạn? Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
