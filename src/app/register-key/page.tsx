import { redirect } from "next/navigation";
import { requireLogin } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";
import { isSecurityKeyRequired } from "@/modules/auth/security-key-policy";
import { logoutAction } from "@/app/logout/actions";
import { RegisterYubikeyButton } from "../security/YubikeyButtons";

// Bắt buộc đăng ký YubiKey: người đã qua 2FA (thường bằng mã app — tài
// khoản cũ trước khi có YubiKey) nhưng chưa có key nào bị requireLogin() đưa
// về đây cho tới khi đăng ký xong.
export default async function RegisterKeyPage() {
  const user = await requireLogin({ skipSecurityKeyCheck: true });

  if (!isSecurityKeyRequired() || user.yubikey) {
    redirect(getDefaultRouteForRole(user.role.name));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Đăng ký YubiKey</h1>
        <p className="mt-2 text-slate-500">
          Từ nay ITAMS dùng <span className="font-semibold">YubiKey</span> làm cách xác thực 2 lớp
          chính. Tài khoản <span className="font-semibold">{user.fullName}</span> cần đăng ký key trước
          khi tiếp tục.
          {user.totpEnabled && " App Authenticator vẫn được giữ lại làm cách dự phòng."}
        </p>

        <div className="mt-6">
          <RegisterYubikeyButton mode="enforce" />
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Chưa có YubiKey? Liên hệ IT/Admin để được cấp key.
        </p>

        <form action={logoutAction} className="mt-6 text-center">
          <button className="text-sm font-medium text-slate-500 hover:text-blue-600">Đăng xuất</button>
        </form>
      </div>
    </div>
  );
}
