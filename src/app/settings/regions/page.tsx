import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth.service";
import { getRegionsWithCounts } from "@/modules/region/region.service";
import { createRegionAction } from "./actions";
import RegionRow from "./RegionRow";
import SubmitButton from "../../components/SubmitButton";
import { ArrowLeft, Plus, MapPin, TriangleAlert, CheckCircle2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Vui lòng nhập tên khu vực.",
  duplicate_name: "Tên khu vực này đã tồn tại, vui lòng chọn tên khác.",
  in_use: "Không thể xoá — khu vực vẫn còn kho hoặc tài khoản đang gán vào. Vui lòng chuyển kho sang khu vực khác (hoặc để trống) và đổi khu vực cho tài khoản liên quan trước.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  created: "Đã tạo khu vực mới.",
  updated: "Đã cập nhật khu vực.",
  deleted: "Đã xoá khu vực.",
};

export default async function RegionsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole(["Admin"]);

  const { error, success } = await searchParams;
  const regions = await getRegionsWithCounts();

  return (
    <AppLayout>
      <Link
        href="/settings/warehouses"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Quản lý kho
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý khu vực</h2>
          <p className="mt-1 text-sm text-slate-500">
            Nhóm nhiều kho lại thành 1 khu vực để gán phân quyền xem cho
            Admin/IT phụ trách nhiều kho cùng lúc.{" "}
            <span className="font-bold text-slate-900">{regions.length}</span>{" "}
            khu vực trong hệ thống
          </p>
        </div>
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
          Thêm khu vực mới
        </h3>

        <form
          action={createRegionAction}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tên khu vực
            </label>
            <input
              name="name"
              required
              placeholder="VD: Dubai"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <SubmitButton
            pendingText="Đang thêm..."
            icon={<Plus size={16} />}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md"
          >
            Thêm khu vực
          </SubmitButton>
        </form>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Sau khi tạo khu vực, vào{" "}
        <Link href="/settings/warehouses" className="font-semibold text-blue-600 hover:underline">
          Quản lý kho
        </Link>{" "}
        để gán từng kho vào khu vực tương ứng, và vào{" "}
        <Link href="/users" className="font-semibold text-blue-600 hover:underline">
          Quản lý tài khoản
        </Link>{" "}
        để gán khu vực cho Admin/IT phụ trách.
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Tên khu vực</th>
              <th className="p-4 text-left">Số kho</th>
              <th className="p-4 text-left">Số tài khoản</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {regions.map((region) => (
              <RegionRow key={region.id} region={region} />
            ))}

            {regions.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-500">
                  <MapPin className="mx-auto mb-2 text-slate-300" size={28} />
                  Chưa có khu vực nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
