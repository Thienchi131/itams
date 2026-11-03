import Link from "next/link";
import { requireLogin } from "@/modules/auth/auth.service";
import { changeOwnPasswordAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  current: "Mật khẩu hiện tại không đúng",
  length: "Mật khẩu mới phải có ít nhất 8 ký tự",
  mismatch: "Nhập lại mật khẩu mới không khớp",
  same: "Mật khẩu mới phải khác mật khẩu hiện tại",
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // skipPasswordCheck: trang này chính là nơi xử lý mustChangePassword, không
  // được tự redirect lại chính nó.
  const user = await requireLogin({ skipPasswordCheck: true });
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        action={changeOwnPasswordAction}
        className="w-full max-w-md rounded-xl border bg-white p-8"
      >
        <h1 className="text-3xl font-bold">Đổi mật khẩu</h1>

        {user.mustChangePassword ? (
          <p className="mt-2 text-slate-500">
            Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được đặt lại).
            Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.
          </p>
        ) : (
          <p className="mt-2 text-slate-500">
            Xin chào <span className="font-semibold">{user.fullName}</span>,
            nhập mật khẩu hiện tại và mật khẩu mới bên dưới.
          </p>
        )}

        {error && ERROR_MESSAGES[error] && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        <input
          className="mt-6 w-full rounded-lg border px-4 py-3"
          name="currentPassword"
          type="password"
          placeholder="Mật khẩu hiện tại"
          required
        />

        <input
          className="mt-4 w-full rounded-lg border px-4 py-3"
          name="newPassword"
          type="password"
          minLength={8}
          placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
          required
        />

        <input
          className="mt-4 w-full rounded-lg border px-4 py-3"
          name="confirmPassword"
          type="password"
          minLength={8}
          placeholder="Nhập lại mật khẩu mới"
          required
        />

        <button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-white">
          Lưu mật khẩu
        </button>

        {!user.mustChangePassword && (
          <Link
            href="/"
            className="mt-4 block text-center text-sm font-medium text-slate-500 hover:text-blue-600"
          >
            Hủy, quay lại
          </Link>
        )}
      </form>
    </div>
  );
}
