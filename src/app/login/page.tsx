import { loginAction } from "./actions";
import PasswordInput from "./PasswordInput";
import ForgotPasswordLink from "./ForgotPasswordLink";
import GoogleLoginButton from "./GoogleLoginButton";
import SubmitButton from "../components/SubmitButton";
import {
  ShieldCheck,
  Mail,
  User,
  Lock,
  Globe,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Cột trái — giới thiệu, chỉ để trang trí, không có logic. Nền là
            ảnh bầu trời thật; khối chữ đặt trong thẻ kính mờ (frosted glass)
            màu trắng + chữ màu xanh navy đậm để luôn đọc rõ, bất kể vùng
            trời phía sau sáng hay có mây trắng. */}
        <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#2f6fed] via-[#4f8ff7] to-[#8ec5fc] p-10 md:flex">
          {/* Gradient phía sau luôn hiện sẵn — nếu vì lý do gì đó ảnh bầu trời
              chưa tải được (VD vừa deploy xong, cache cũ...) thì panel vẫn
              có màu xanh đẹp thay vì trắng trơn kèm icon ảnh vỡ. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh
              trong public/, không cần qua pipeline tối ưu ảnh của Next. */}
          <img
            src="/login-sky.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="relative">
            <div className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck size={22} />
              </div>

              <div>
                <h1 className="text-xl font-bold leading-tight text-slate-900">
                  ITAMS
                </h1>
                <p className="text-xs text-slate-600">
                  IT Asset Management System
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="h-0.5 w-10 bg-blue-500" />

              <p className="mt-3 max-w-[230px] text-sm font-bold leading-snug text-slate-900">
                Hệ thống quản lý tài sản IT
              </p>

              <p className="mt-1.5 max-w-[230px] text-sm leading-relaxed text-slate-700">
                Do team IT đồng phát triển, đề cao sự minh bạch và hiệu quả.
              </p>
            </div>
          </div>

          <div className="relative mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh
                trong public/, không cần qua pipeline tối ưu ảnh của Next. */}
            <img
              src="/mascot-ver2.png"
              alt="ITAMS mascot"
              width={340}
              height={227}
              className="mx-auto object-contain drop-shadow-2xl"
            />
          </div>

          <div className="relative flex items-center gap-3 rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck size={20} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">
                Bảo mật &amp; an toàn
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Dữ liệu của bạn được bảo vệ với công nghệ mã hóa tiên tiến.
              </p>
            </div>
          </div>
        </div>

        {/* Cột phải — form đăng nhập thật. */}
        <form
          action={loginAction}
          className="relative w-full p-8 sm:p-12 md:w-[56%]"
        >
          <div className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <Globe size={14} />
            VI
            <ChevronDown size={12} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Chào mừng trở lại! 👋
          </h2>
          <p className="mt-2 text-slate-500">
            Đăng nhập để tiếp tục quản lý tài sản IT
          </p>

          {reset === "success" && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.
            </p>
          )}

          {error === "rate_limited" && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Bạn đã thử sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.
            </p>
          )}

          {error && error !== "rate_limited" && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Sai username hoặc password
            </p>
          )}

          <div className="mt-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Mail size={16} />
              Email
            </label>

            <div className="relative">
              <User
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                name="email"
                type="email"
                required
                placeholder="Nhập email của bạn"
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <PasswordInput />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="remember"
                className="h-4 w-4 rounded accent-blue-600"
              />
              Ghi nhớ đăng nhập
            </label>

            <ForgotPasswordLink />
          </div>

          <SubmitButton
            pendingText="Đang đăng nhập..."
            icon={<ShieldCheck size={18} />}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
          >
            Đăng nhập
          </SubmitButton>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            hoặc
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleLoginButton />

          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Lock size={12} />
            Hệ thống chỉ dành cho nhân viên được cấp quyền
          </p>

          <p className="mt-2 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} ITAMS. All rights reserved.
          </p>
        </form>
      </div>
    </div>
  );
}
