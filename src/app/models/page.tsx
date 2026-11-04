import AppLayout from "../components/AppLayout";
import { getAssetModels } from "@/modules/models/model.service";
import { requireLogin } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import ModelsTable from "./ModelsTable";
import Link from "next/link";
import { Plus, Search, TriangleAlert, CheckCircle2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  in_use: "Không thể xoá — model vẫn còn thiết bị đang sử dụng. Vui lòng chuyển/xoá hết thiết bị thuộc model này trước.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  deleted: "Đã xoá model.",
  merged: "Đã gộp model thành công.",
};

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  const currentUser = await requireLogin();
  const isAdmin = currentUser.role.name === ROLE_ADMIN;

  const { q, error, success } = await searchParams;
  const models = await getAssetModels(q);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Model Library</h2>
          <p className="mt-1 text-slate-500">
            Danh mục model thiết bị dùng cho nhập kho
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/models/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            Thêm Model
          </Link>
        )}
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form className="border-b border-slate-100 p-5">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Tìm theo Model Code, Brand, Model hoặc Loại..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {isAdmin && (
            <p className="mt-3 text-xs text-slate-400">
              Tick chọn 2 model trở lên bị trùng thông tin nhưng khác Model
              Code (VD: lỗi gõ tạo 2 mã cho cùng 1 model) để gộp lại thành 1.
            </p>
          )}
        </form>

        <ModelsTable models={models} isAdmin={isAdmin} q={q ?? ""} />
      </div>
    </AppLayout>
  );
}