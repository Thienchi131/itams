import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { createEntryAction, setWhitelistEnabledAction } from "./actions";
import EntryRow from "./EntryRow";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import SubmitButton from "@/app/components/SubmitButton";
import {
  ArrowLeft,
  Plus,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  CheckCircle2,
  Wifi,
} from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Vui lòng nhập đầy đủ thông tin.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  created: "Đã thêm IP vào whitelist.",
  deleted: "Đã xoá IP khỏi whitelist.",
  enabled: "Đã BẬT whitelist IP — chỉ các IP trong danh sách mới truy cập được hệ thống.",
  disabled: "Đã TẮT whitelist IP — mọi IP đều truy cập được như bình thường.",
};

export default async function IpWhitelistSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole(["Admin"]);

  const { error, success } = await searchParams;

  const [config, entries, headerList] = await Promise.all([
    prisma.ipWhitelistConfig.findUnique({ where: { id: 1 } }),
    prisma.ipWhitelistEntry.findMany({ orderBy: { createdAt: "desc" } }),
    headers(),
  ]);

  const enabled = config?.enabled ?? false;

  // Header này do custom server (server-with-ip-whitelist.js) ghi đè bằng IP
  // thật từ socket TCP trước khi Next.js xử lý — đáng tin trên production.
  // Chạy `next dev` cục bộ (không qua custom server) sẽ không có header này.
  const visitorIp =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

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
        <h2 className="text-2xl font-bold text-slate-900">Whitelist IP</h2>
        <p className="mt-1 text-sm text-slate-500">
          Khi bật, chỉ các IP trong danh sách bên dưới mới truy cập được hệ
          thống — kể cả trang đăng nhập.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <TriangleAlert size={16} className="shrink-0" />
          {ERROR_MESSAGES[error] ?? error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            {enabled ? (
              <ShieldCheck size={16} className="text-emerald-600" />
            ) : (
              <ShieldOff size={16} className="text-slate-400" />
            )}
            Trạng thái whitelist
          </h3>

          <p className="mb-4 text-sm text-slate-600">
            Hiện đang{" "}
            <span className={enabled ? "font-bold text-emerald-600" : "font-bold text-slate-500"}>
              {enabled ? "BẬT" : "TẮT"}
            </span>
            {config?.updatedBy && (
              <span className="text-slate-400">
                {" "}
                — cập nhật lần cuối bởi {config.updatedBy}
              </span>
            )}
          </p>

          {enabled ? (
            <form action={setWhitelistEnabledAction}>
              <input type="hidden" name="enabled" value="false" />
              <ConfirmActionButton
                label="Tắt whitelist"
                confirmTitle="Tắt whitelist IP?"
                confirmMessage="Sau khi tắt, mọi IP đều truy cập được hệ thống như bình thường (không giới hạn theo IP nữa)."
                confirmLabel="Tắt"
                color="rose"
                icon={<ShieldOff size={15} />}
              />
            </form>
          ) : (
            <form action={setWhitelistEnabledAction}>
              <input type="hidden" name="enabled" value="true" />
              <ConfirmActionButton
                label="Bật whitelist"
                confirmTitle="Bật whitelist IP?"
                confirmMessage="Sau khi bật, CHỈ các IP có trong danh sách bên dưới mới truy cập được hệ thống — kể cả trang đăng nhập, kể cả tài khoản Admin. Hãy chắc chắn đã thêm IP của chính bạn trước khi bật."
                confirmLabel="Bật"
                color="amber"
                icon={<ShieldCheck size={15} />}
              />
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Wifi size={16} className="text-blue-600" />
            IP hiện tại của bạn
          </h3>

          {visitorIp ? (
            <>
              <p className="mb-4 text-2xl font-bold text-slate-900">{visitorIp}</p>
              <form action={createEntryAction} className="flex gap-2">
                <input type="hidden" name="cidr" value={visitorIp} />
                <input
                  name="description"
                  placeholder="Ghi chú (VD: Văn phòng, nhà riêng...)"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
                <SubmitButton
                  pendingText="Đang thêm..."
                  icon={<Plus size={15} />}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Thêm IP này
                </SubmitButton>
              </form>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Không xác định được (chỉ hoạt động khi chạy qua custom server
              trên production, không hoạt động ở môi trường dev).
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Plus size={16} className="text-blue-600" />
          Thêm IP / dải CIDR mới
        </h3>

        <form action={createEntryAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              IP hoặc dải CIDR
            </label>
            <input
              name="cidr"
              required
              placeholder="VD: 203.0.113.5 hoặc 203.0.113.0/24"
              className="w-64 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Ghi chú
            </label>
            <input
              name="description"
              placeholder="VD: Văn phòng Dubai"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <SubmitButton
            pendingText="Đang thêm..."
            icon={<Plus size={16} />}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md"
          >
            Thêm
          </SubmitButton>
        </form>

        <p className="mt-3 text-xs text-slate-400">
          CIDR hiện chỉ hỗ trợ IPv4 (VD: 203.0.113.0/24). Với IPv6 chỉ nhập
          được chính xác 1 địa chỉ, không hỗ trợ dải.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">IP / CIDR</th>
              <th className="p-4 text-left">Ghi chú</th>
              <th className="p-4 text-left">Người thêm</th>
              <th className="p-4 text-left">Ngày thêm</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}

            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-500">
                  <ShieldOff className="mx-auto mb-2 text-slate-300" size={28} />
                  Chưa có IP nào trong whitelist
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
