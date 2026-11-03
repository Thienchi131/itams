import Link from "next/link";
import { requestPasswordResetAction } from "./actions";
import SubmitButton from "../components/SubmitButton";
import {
  ShieldCheck,
  Mail,
  ArrowLeft,
  MailCheck,
  TriangleAlert,
} from "lucide-react";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <ShieldCheck size={28} />
        </div>

        {sent ? (
          <>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">
              Kiểm tra email của bạn
            </h2>

            <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <MailCheck size={18} className="mt-0.5 shrink-0 text-emerald-500" />
              Nếu email bạn nhập có tồn tại trong hệ thống, chúng tôi đã gửi
              một link đặt lại mật khẩu tới email đó. Link có hiệu lực trong
              1 giờ.
            </p>

            <p className="mt-4 text-xs text-slate-400">
              Không thấy email? Kiểm tra thêm ở mục Spam/Junk, hoặc thử lại
              sau vài phút.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">
              Quên mật khẩu?
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Nhập email đăng nhập, chúng tôi sẽ gửi link đặt lại mật khẩu.
            </p>

            {(error === "expired" || error === "invalid_token") && (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                <TriangleAlert size={16} className="shrink-0" />
                Link trước đó đã hết hạn hoặc không hợp lệ. Nhập lại email để
                nhận link mới.
              </p>
            )}

            <form action={requestPasswordResetAction} className="mt-6">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
                <Mail size={16} />
                Email
              </label>

              <input
                name="email"
                type="email"
                required
                placeholder="Nhập email đăng nhập của bạn"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <SubmitButton
                pendingText="Đang gửi..."
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Gửi link đặt lại mật khẩu
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
