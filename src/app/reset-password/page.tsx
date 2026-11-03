import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/reset-token";
import { resetPasswordAction } from "./actions";
import SubmitButton from "../components/SubmitButton";
import { ShieldCheck, ArrowLeft, TriangleAlert } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  length: "Mật khẩu mới phải có ít nhất 8 ký tự",
  mismatch: "Nhập lại mật khẩu mới không khớp",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  // Kiểm tra token ngay ở server component, trước khi hiện form — để báo
  // "link hết hạn/không hợp lệ" ngay lập tức thay vì để user điền xong mật
  // khẩu mới rồi mới biết submit thất bại.
  const resetToken = token
    ? await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(token) },
      })
    : null;

  const isValidToken =
    Boolean(token) &&
    Boolean(resetToken) &&
    !resetToken?.usedAt &&
    (resetToken?.expiresAt ?? new Date(0)) > new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <ShieldCheck size={28} />
        </div>

        {!isValidToken ? (
          <>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">
              Link không hợp lệ hoặc đã hết hạn
            </h2>

            <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <TriangleAlert
                size={18}
                className="mt-0.5 shrink-0 text-amber-500"
              />
              Link đặt lại mật khẩu này đã hết hạn, đã được dùng, hoặc không
              hợp lệ. Vui lòng yêu cầu gửi lại 1 link mới.
            </p>

            <Link
              href="/forgot-password"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Gửi lại link đặt lại mật khẩu
            </Link>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">
              Đặt mật khẩu mới
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Nhập mật khẩu mới cho tài khoản của bạn.
            </p>

            {error && ERROR_MESSAGES[error] && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {ERROR_MESSAGES[error]}
              </p>
            )}

            <form action={resetPasswordAction} className="mt-6 space-y-4">
              <input type="hidden" name="token" value={token} />

              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="newPassword"
                type="password"
                minLength={8}
                placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                required
              />

              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="confirmPassword"
                type="password"
                minLength={8}
                placeholder="Nhập lại mật khẩu mới"
                required
              />

              <SubmitButton
                pendingText="Đang lưu..."
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Đặt lại mật khẩu
              </SubmitButton>
            </form>
          </>
        )}

        <Link
          href="/login"
          className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}
