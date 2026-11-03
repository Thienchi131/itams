import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth.service";
import { getAuditLogs } from "@/modules/audit/audit-log.service";
import LocalDateTime from "../../components/LocalDateTime";
import Pagination from "../../components/Pagination";
import { ArrowLeft, ClipboardList } from "lucide-react";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole(["Admin"]);

  const { page } = await searchParams;
  const currentPage = Number(page ?? "1");

  const { logs, total, totalPages } = await getAuditLogs(currentPage);

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
        <h2 className="text-2xl font-bold text-slate-900">Nhật ký thao tác</h2>
        <p className="mt-1 text-sm text-slate-500">
          Toàn bộ <span className="font-bold text-slate-900">{total}</span> thao
          tác nhạy cảm: tài khoản, whitelist IP, Import Excel, gộp/xoá Model...
          (không bao gồm lịch sử tài sản — xem ở trang Hoạt động)
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-6 p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <ClipboardList size={16} />
                </div>

                <div>
                  <p className="font-bold text-slate-900">
                    {log.action}
                    {log.targetType && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {log.targetType}
                        {log.targetId ? ` #${log.targetId}` : ""}
                      </span>
                    )}
                  </p>

                  {log.detail && (
                    <p className="mt-1 text-sm text-slate-500">{log.detail}</p>
                  )}

                  <p className="mt-1 text-xs text-slate-400">
                    Thực hiện bởi: {log.actorName}
                  </p>
                </div>
              </div>

              <span className="whitespace-nowrap text-sm text-slate-400">
                <LocalDateTime value={log.createdAt} mode="datetime" />
              </span>
            </div>
          ))}

          {logs.length === 0 && (
            <p className="p-8 text-center text-slate-500">Chưa có thao tác nào được ghi nhận</p>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/settings/audit-log"
        />
      </div>
    </AppLayout>
  );
}
