import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, TriangleAlert, CircleAlert, CircleSlash, CircleCheck } from "lucide-react";
import { importAssetsAction } from "./actions";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import ImportForm from "./ImportForm";

export default async function ImportAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; warning?: string; success?: string }>;
}) {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);
  const isAdmin = currentUser.role.name === ROLE_ADMIN;

  const { error, warning, success } = await searchParams;

  const importSettings = await prisma.importSettings.findUnique({ where: { id: 1 } });
  const importEnabled = importSettings?.enabled ?? true;

  // Tính năng bị Admin tắt qua Cài đặt > Import Excel — chặn thẳng ở đây
  // (không chỉ ẩn nút ở trang danh sách) để IT không bấm thẳng URL né qua
  // được. Admin (người quản lý công tắc này) luôn dùng được, kể cả lúc tắt.
  if (!importEnabled && !isAdmin) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Link
            href="/assets"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft size={16} />
            Quay lại
          </Link>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <CircleSlash size={32} className="text-slate-300" />
            <p className="text-lg font-bold text-slate-700">
              Tính năng Import Excel đang bị tắt
            </p>
            <p className="max-w-md text-sm text-slate-500">
              Admin đã tạm tắt tính năng này trong Cài đặt. Vui lòng liên hệ
              Admin nếu cần import gấp.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">
            Import tài sản
          </h1>
          <p className="mt-2 text-slate-500">
            Import thiết bị từ file Excel
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Import thất bại</p>
              <p className="mt-1 whitespace-pre-line">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <CircleCheck size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Import thành công</p>
              <p className="mt-1 whitespace-pre-line">{success}</p>
              <p className="mt-2">
                Xem chi tiết từng thay đổi ở{" "}
                <Link href="/activity" className="font-medium underline">
                  Lịch sử thay đổi
                </Link>{" "}
                hoặc quay lại{" "}
                <Link href="/assets" className="font-medium underline">
                  danh sách thiết bị
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {warning && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <CircleAlert size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">
                Import thành công, nhưng có dòng bị bỏ qua do thiếu dữ liệu
              </p>
              <p className="mt-1 whitespace-pre-line">{warning}</p>
              <p className="mt-2 text-amber-600">
                Vui lòng bổ sung dữ liệu còn thiếu ở các dòng trên rồi import
                lại riêng các dòng đó nếu cần.
              </p>
              <p className="mt-2">
                Xem chi tiết những thiết bị đã tạo/cập nhật ở{" "}
                <Link href="/activity" className="font-medium underline">
                  Lịch sử thay đổi
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        <ImportForm action={importAssetsAction}>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold">Upload file Excel</h2>

            <input
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            />

            <div className="mt-6 rounded-2xl bg-blue-50 p-5 text-sm text-blue-700">
              File cần có các cột: Serial Number, Model Code, Warehouse
            </div>
          </section>
        </ImportForm>
      </div>
    </AppLayout>
  );
}