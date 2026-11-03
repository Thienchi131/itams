import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import ModelTagRow from "./ModelTagRow";
import { ArrowLeft, Search, CheckCircle2, Tags } from "lucide-react";

const SUCCESS_MESSAGES: Record<string, string> = {
  updated: "Đã cập nhật tag.",
};

// Trang gán tag 🆗 Cấp phát được / 🅱️ Backup HÀNG LOẠT cho toàn bộ Model —
// chỉ Admin được vào (giống mọi trang con khác trong Cài đặt). Tag gắn ở
// đây hiển thị lại ở cột "Tag" trong bảng Quản lý tài sản (/assets), áp
// dụng chung cho MỌI thiết bị thuộc model đó (xem ghi chú ở
// AssetModel.tag trong schema.prisma).
export default async function ModelTagsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; success?: string }>;
}) {
  await requireRole([ROLE_ADMIN]);

  const { q, success } = await searchParams;
  const query = q?.trim();

  const models = await prisma.assetModel.findMany({
    where: query
      ? {
          OR: [
            { modelCode: { contains: query, mode: "insensitive" } },
            { brand: { contains: query, mode: "insensitive" } },
            { modelName: { contains: query, mode: "insensitive" } },
            { category: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { brand: "asc" }, { modelName: "asc" }],
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

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <Tags size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tag Model</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gắn 🆗 (thiết bị cấp phát được) hoặc 🅱️ (thiết bị backup) cho từng
            model — áp dụng cho mọi thiết bị cùng model, hiển thị ở cột &quot;Tag&quot;
            trong bảng Quản lý tài sản. Chọn lại &quot;— Không gắn —&quot; để bỏ tag.
          </p>
        </div>
      </div>

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
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Tìm theo tên model, mã model, hãng hoặc loại thiết bị..."
            />
          </div>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Loại thiết bị</th>
              <th className="p-4 text-left">Model</th>
              <th className="p-4 text-left">Mã model</th>
              <th className="w-56 p-4 text-left">Tag</th>
            </tr>
          </thead>

          <tbody>
            {models.map((model) => (
              <ModelTagRow
                key={model.id}
                model={{
                  id: model.id,
                  categoryName: model.category.name,
                  brand: model.brand,
                  modelName: model.modelName,
                  modelCode: model.modelCode,
                  tag: model.tag,
                }}
              />
            ))}

            {models.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-500">
                  Không tìm thấy model phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
