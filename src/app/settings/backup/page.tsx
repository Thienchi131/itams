import Link from "next/link";
import AppLayout from "../../components/AppLayout";
import {
  ArrowLeft,
  DatabaseBackup,
  Download,
  RotateCcw,
  UploadCloud,
  CheckCircle2,
  Lock,
  LockOpen,
  Laptop,
  TriangleAlert,
} from "lucide-react";
import { requireRole } from "@/modules/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { listBackups, formatBytes } from "@/modules/backup/backup.service";
import { restoreExistingAction, restoreUploadAction } from "./actions";
import RestoreConfirmModal from "./RestoreConfirmModal";
import DeleteBackupButton from "./DeleteBackupButton";
import CreateBackupForm from "./CreateBackupForm";

// Quá hạn nếu hơn 26 giờ chưa có lần báo cáo THÀNH CÔNG nào — máy backup
// (VD: Mac) hẹn chạy 1 lần/ngày (xem scripts/backup-pull-to-mac.sh), 26 giờ
// (thay vì đúng 24) để chừa dư 2 tiếng cho các trường hợp máy khởi động trễ
// hoặc mạng chập chờn 1 lần, không báo động giả oan uổng.
const OVERDUE_HOURS = 26;

type PullSourceStatus = {
  source: string;
  lastAt: Date;
  lastStatus: string;
  lastMessage: string | null;
  lastSuccessAt: Date | null;
  overdue: boolean;
};

function summarizePullLogsBySource(
  logs: { source: string; status: string; message: string | null; createdAt: Date }[]
): PullSourceStatus[] {
  const map = new Map<string, PullSourceStatus>();

  for (const log of logs) {
    const existing = map.get(log.source);
    if (!existing) {
      map.set(log.source, {
        source: log.source,
        lastAt: log.createdAt,
        lastStatus: log.status,
        lastMessage: log.message,
        lastSuccessAt: log.status === "success" ? log.createdAt : null,
        overdue: false,
      });
    } else if (log.status === "success" && !existing.lastSuccessAt) {
      existing.lastSuccessAt = log.createdAt;
    }
  }

  const now = Date.now();
  for (const status of map.values()) {
    status.overdue =
      !status.lastSuccessAt ||
      now - status.lastSuccessAt.getTime() > OVERDUE_HOURS * 60 * 60 * 1000;
  }

  return Array.from(map.values());
}

const SUCCESS_MESSAGES: Record<string, string> = {
  created: "Đã tạo backup mới thành công.",
  deleted: "Đã xoá file backup.",
  restored:
    "Đã khôi phục database thành công. Hệ thống đã tự tạo 1 bản backup an toàn ngay trước khi khôi phục (xem trong danh sách bên dưới).",
};

export default async function BackupSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  await requireRole(["Admin"]);

  const { success } = await searchParams;
  const backups = await listBackups();

  const pullLogs = await prisma.backupPullLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const pullSourceStatuses = summarizePullLogsBySource(pullLogs);

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
        <h2 className="text-2xl font-bold text-slate-900">Backup &amp; Restore</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sao lưu và khôi phục toàn bộ dữ liệu PostgreSQL của hệ thống. File
          backup mới được mã hoá AES-256-GCM (đuôi .sql.gz.enc) — nếu lỡ lộ
          ra ngoài cũng không đọc được nếu không có khoá BACKUP_ENCRYPTION_KEY
          trên VPS. Dùng chung thư mục với cron backup tự động hằng ngày.
        </p>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Laptop size={16} className="text-indigo-600" />
          Máy backup ngoài
        </h3>

        {pullSourceStatuses.length === 0 ? (
          <p className="text-sm text-slate-400">
            Chưa có máy backup ngoài nào từng báo cáo — xem hướng dẫn thiết
            lập trong <code className="rounded bg-slate-100 px-1.5 py-0.5">scripts/backup-pull-to-mac.sh</code>.
          </p>
        ) : (
          <div className="space-y-3">
            {pullSourceStatuses.map((s) => (
              <div
                key={s.source}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                  s.overdue
                    ? "border-rose-200 bg-rose-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{s.source}</p>
                  <p className="text-xs text-slate-500">
                    Lần thành công gần nhất:{" "}
                    {s.lastSuccessAt
                      ? s.lastSuccessAt.toLocaleString("vi-VN")
                      : "chưa từng thành công"}
                  </p>
                  {s.lastStatus === "error" && (
                    <p className="mt-1 text-xs text-rose-600">
                      Lần báo cáo gần nhất bị lỗi: {s.lastMessage ?? "(không có chi tiết)"}
                    </p>
                  )}
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    s.overdue
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {s.overdue ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
                  {s.overdue ? "Quá hạn — kiểm tra lại" : "Đang chạy đều"}
                </span>
              </div>
            ))}
          </div>
        )}

        {pullLogs.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 font-semibold uppercase text-slate-400">
                  <th className="pb-2">Máy</th>
                  <th className="pb-2">Trạng thái</th>
                  <th className="pb-2">Số file</th>
                  <th className="pb-2">Thời gian</th>
                  <th className="pb-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {pullLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="border-b border-slate-50">
                    <td className="py-2 text-slate-700">{log.source}</td>
                    <td className="py-2">
                      {log.status === "success" ? (
                        <span className="font-semibold text-emerald-600">Thành công</span>
                      ) : (
                        <span className="font-semibold text-rose-600">Lỗi</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-600">{log.fileCount ?? "-"}</td>
                    <td className="py-2 text-slate-500">
                      {log.createdAt.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2 text-slate-500">{log.message ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <DatabaseBackup size={16} className="text-blue-600" />
          Tạo backup mới
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Tạo ngay 1 bản sao lưu toàn bộ database tại thời điểm hiện tại —
          không ảnh hưởng gì tới hệ thống đang chạy.
        </p>
        <CreateBackupForm />
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <RotateCcw size={16} className="text-amber-600" />
          Danh sách backup ({backups.length})
        </h3>

        {backups.length === 0 ? (
          <p className="text-sm text-slate-400">
            Chưa có file backup nào — bấm &quot;Tạo backup ngay&quot; ở trên,
            hoặc chờ cron tự động chạy (2h sáng hằng ngày).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                  <th className="pb-3">Tên file</th>
                  <th className="pb-3">Mã hoá</th>
                  <th className="pb-3">Kích thước</th>
                  <th className="pb-3">Thời gian tạo</th>
                  <th className="pb-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.name} className="border-b border-slate-50">
                    <td className="py-3 font-mono text-xs text-slate-700">
                      {b.name}
                    </td>
                    <td className="py-3">
                      {b.encrypted ? (
                        <span
                          title="Đã mã hoá AES-256-GCM — không đọc được nếu không có BACKUP_ENCRYPTION_KEY"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                        >
                          <Lock size={12} />
                          Đã mã hoá
                        </span>
                      ) : (
                        <span
                          title="File cũ, tạo trước khi có tính năng mã hoá — chưa được bảo vệ nếu bị lộ"
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                        >
                          <LockOpen size={12} />
                          Chưa mã hoá
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-600">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="py-3 text-slate-600">
                      {b.createdAt.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/settings/backup/download/${encodeURIComponent(b.name)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          <Download size={14} />
                          Tải xuống
                        </a>

                        <RestoreConfirmModal
                          action={restoreExistingAction}
                          triggerLabel="Khôi phục"
                          title="Khôi phục từ file này?"
                          description={`Toàn bộ dữ liệu hiện tại sẽ được thay bằng nội dung của "${b.name}".`}
                        >
                          <input type="hidden" name="name" value={b.name} />
                        </RestoreConfirmModal>

                        <DeleteBackupButton name={b.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <UploadCloud size={16} className="text-slate-500" />
          Khôi phục từ file tải lên
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Dùng khi cần khôi phục từ 1 file .sql.gz không có sẵn trong danh
          sách trên (VD: backup tải về từ VPS khác, hoặc backup tải thủ công
          trước khi có tính năng này).
        </p>

        <RestoreConfirmModal
          action={restoreUploadAction}
          triggerLabel="Chọn file & khôi phục"
          triggerClassName="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100"
          title="Khôi phục từ file tải lên"
          description="Chọn file .sql.gz do chính tính năng Backup của hệ thống tạo ra."
        >
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              File backup (.sql.gz)
            </label>
            <input
              type="file"
              name="file"
              accept=".gz"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />
          </div>
        </RestoreConfirmModal>
      </div>
    </AppLayout>
  );
}
