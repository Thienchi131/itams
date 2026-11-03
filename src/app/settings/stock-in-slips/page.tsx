import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth.service";
import { getStockInSlips } from "@/modules/stockIn/stockIn.service";
import { deleteStockInSlipAction } from "./actions";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import LocalDateTime from "@/app/components/LocalDateTime";
import {
  ArrowLeft,
  PackageCheck,
  Trash2,
  Eye,
  TriangleAlert,
  CheckCircle2,
  FileSpreadsheet,
  FilePenLine,
} from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Không tìm thấy phiếu nhập này — có thể đã bị xoá rồi.",
  has_active_assets:
    "Không thể xoá — phiếu này có thiết bị đã được cấp phát/thay đổi (không còn nguyên trạng lúc mới nhập).",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  deleted: "Đã xoá phiếu nhập và toàn bộ thiết bị nguyên trạng của phiếu.",
};

export default async function StockInSlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string; slip?: string; success?: string }>;
}) {
  await requireRole(["Admin"]);

  const { error, detail, slip, success } = await searchParams;
  const slips = await getStockInSlips();

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
        <h2 className="text-2xl font-bold text-slate-900">Phiếu nhập kho</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tổng cộng{" "}
          <span className="font-bold text-slate-900">{slips.length}</span>{" "}
          phiếu — gồm cả phiếu tạo tay và phiếu do Import Excel tạo ra
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="shrink-0" />
            {ERROR_MESSAGES[error] ?? "Có lỗi xảy ra, vui lòng thử lại."}
            {slip ? ` (Phiếu: ${slip})` : ""}
          </div>

          {detail && (
            <p className="mt-2 pl-6 text-xs leading-5 text-rose-600">{detail}</p>
          )}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Số phiếu</th>
              <th className="p-4 text-left">Nguồn</th>
              <th className="p-4 text-left">Loại nhập</th>
              <th className="p-4 text-left">Kho</th>
              <th className="p-4 text-center">Số thiết bị</th>
              <th className="p-4 text-left">Người tạo</th>
              <th className="p-4 text-left">Ngày tạo</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {slips.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 transition hover:bg-blue-50/40">
                <td className="p-4 font-bold text-slate-900">{s.slipNo}</td>

                <td className="p-4">
                  {s.source === "import" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      <FileSpreadsheet size={13} />
                      Import Excel
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      <FilePenLine size={13} />
                      Nhập tay
                    </span>
                  )}
                </td>

                <td className="p-4 text-slate-600">
                  {s.stockInType === "RETURNED" ? "Thu hồi" : "Mua mới"}
                </td>

                <td className="p-4">
                  {s.warehouses.length === 0 ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      -
                    </span>
                  ) : s.warehouses.length === 1 ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {s.warehouses[0].code} - {s.warehouses[0].name}
                    </span>
                  ) : (
                    <span
                      className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
                      title={s.warehouses.map((w) => `${w.code} - ${w.name}`).join(", ")}
                    >
                      {s.warehouses.length} kho khác nhau
                    </span>
                  )}
                </td>

                <td className="p-4 text-center">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                    <PackageCheck size={14} className="text-emerald-600" />
                    {s.itemCount}
                  </span>
                </td>

                <td className="p-4 text-slate-600">{s.createdBy ?? "-"}</td>

                <td className="p-4 text-slate-500">
                  <LocalDateTime value={s.createdAt} />
                </td>

                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/settings/stock-in-slips/${s.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={15} />
                      Xem
                    </Link>

                    <form action={deleteStockInSlipAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmActionButton
                        label="Xoá"
                        confirmTitle="Xác nhận xoá phiếu nhập"
                        confirmMessage={`Xoá phiếu ${s.slipNo} sẽ xoá luôn toàn bộ ${s.itemCount} thiết bị nguyên trạng của phiếu này (chỉ khi chưa cấp phát/thay đổi gì). Bạn có chắc chắn?`}
                        confirmLabel="Xoá"
                        color="rose"
                        icon={<Trash2 size={15} />}
                      />
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {slips.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-500">
                  <PackageCheck className="mx-auto mb-2 text-slate-300" size={28} />
                  Chưa có phiếu nhập kho nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
