import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { getWarehousesWithCounts } from "@/modules/warehouse/warehouse.service";
import { createWarehouseAction } from "./actions";
import WarehouseRow from "./WarehouseRow";
import SubmitButton from "../../components/SubmitButton";
import { ArrowLeft, Plus, Warehouse, TriangleAlert, CheckCircle2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Vui lòng nhập đầy đủ Mã kho và Tên kho.",
  duplicate_code: "Mã kho này đã tồn tại, vui lòng chọn mã khác.",
  in_use: "Không thể xoá — kho vẫn còn tài sản, vật tư, hoặc tài khoản đang được gán trực tiếp vào kho này. Vui lòng luân chuyển/đổi phạm vi trước.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  created: "Đã tạo kho mới.",
  updated: "Đã cập nhật kho.",
  deleted: "Đã xoá kho.",
};

export default async function WarehousesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole(["Admin"]);

  const { error, success } = await searchParams;
  const [warehouses, regions] = await Promise.all([
    getWarehousesWithCounts(),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppLayout>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Cài đặt
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý kho</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tổng cộng{" "}
            <span className="font-bold text-slate-900">{warehouses.length}</span>{" "}
            kho trong hệ thống
          </p>
        </div>

        <Link
          href="/settings/regions"
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Quản lý Khu vực
        </Link>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <TriangleAlert size={16} className="shrink-0" />
          {ERROR_MESSAGES[error] ?? "Có lỗi xảy ra, vui lòng thử lại."}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Plus size={16} className="text-blue-600" />
          Thêm kho mới
        </h3>

        <form
          action={createWarehouseAction}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Mã kho
            </label>
            <input
              name="code"
              required
              maxLength={10}
              placeholder="VD: SGN"
              className="w-36 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold uppercase outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tên kho
            </label>
            <input
              name="name"
              required
              placeholder="VD: Sài Gòn - Việt Nam"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Khu vực
            </label>
            <select
              name="regionId"
              defaultValue=""
              className="w-44 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">-- Không thuộc khu vực --</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <label className="mb-0.5 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              name="isShared"
              className="h-4 w-4 accent-blue-600"
            />
            Dùng chung cho tất cả mọi người
          </label>

          <SubmitButton
            pendingText="Đang thêm..."
            icon={<Plus size={16} />}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md"
          >
            Thêm kho
          </SubmitButton>
        </form>

        <p className="mt-3 text-xs text-slate-400">
          &quot;Dùng chung cho tất cả mọi người&quot;: kho này sẽ hiển thị/thao tác
          được cho MỌI tài khoản, kể cả đang bị giới hạn theo khu vực hoặc 1
          kho cụ thể — dùng cho các kho đặc biệt như kho máy đã thanh lý/hết
          khấu hao.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Mã kho</th>
              <th className="p-4 text-left">Tên kho</th>
              <th className="p-4 text-left">Số tài sản</th>
              <th className="p-4 text-left">Khu vực</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {warehouses.map((warehouse) => (
              <WarehouseRow key={warehouse.id} warehouse={warehouse} regions={regions} />
            ))}

            {warehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-500">
                  <Warehouse className="mx-auto mb-2 text-slate-300" size={28} />
                  Chưa có kho nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
