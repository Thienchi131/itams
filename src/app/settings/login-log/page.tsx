import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth.service";
import { getLoginAttempts } from "@/modules/auth/login-attempt.service";
import LocalDateTime from "../../components/LocalDateTime";
import Pagination from "../../components/Pagination";
import { ArrowLeft, CheckCircle2, XCircle, Search } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Sai email/mật khẩu",
  rate_limited: "Bị chặn do thử quá nhiều lần",
};

export default async function LoginLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; username?: string; onlyFailed?: string }>;
}) {
  await requireRole(["Admin"]);

  const { page, username, onlyFailed } = await searchParams;
  const currentPage = Number(page ?? "1");
  const onlyFailedBool = onlyFailed === "1";

  const { attempts, total, totalPages } = await getLoginAttempts(currentPage, {
    username,
    onlyFailed: onlyFailedBool,
  });


  return (
    <AppLayout>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Cài đặt
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Nhật ký đăng nhập</h2>
        <p className="mt-1 text-sm text-slate-500">
          Toàn bộ <span className="font-bold text-slate-900">{total}</span> lượt
          thử đăng nhập (thành công + thất bại) trên hệ thống
        </p>
      </div>

      <form className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="username"
            defaultValue={username ?? ""}
            placeholder="Tìm theo email đăng nhập..."
            className="w-72 rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="onlyFailed"
            value="1"
            defaultChecked={onlyFailedBool}
            className="h-4 w-4 rounded border-slate-300"
          />
          Chỉ hiện thất bại
        </label>

        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Lọc
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Kết quả</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">IP</th>
              <th className="p-4 text-left">Lý do</th>
              <th className="p-4 text-right">Thời gian</th>
            </tr>
          </thead>

          <tbody>
            {attempts.map((attempt) => (
              <tr
                key={attempt.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="p-4">
                  {attempt.success ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                      <CheckCircle2 size={14} />
                      Thành công
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 font-bold text-rose-700">
                      <XCircle size={14} />
                      Thất bại
                    </span>
                  )}
                </td>
                <td className="p-4 font-medium text-slate-900">{attempt.username}</td>
                <td className="p-4 text-slate-600">{attempt.ip}</td>
                <td className="p-4 text-slate-500">
                  {attempt.reason ? REASON_LABELS[attempt.reason] ?? attempt.reason : "-"}
                </td>
                <td className="p-4 text-right text-slate-400">
                  <LocalDateTime value={attempt.createdAt} mode="datetime" />
                </td>
              </tr>
            ))}

            {attempts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-500">
                  Không có dữ liệu phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/settings/login-log"
          query={{ username, onlyFailed: onlyFailedBool ? "1" : undefined }}
        />
      </div>
    </AppLayout>
  );
}
