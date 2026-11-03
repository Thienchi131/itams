"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Edit, Trash2, GitMerge, X } from "lucide-react";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import { deleteModelAction } from "./actions";
import MergeModelsModal from "./MergeModelsModal";

type ModelItem = {
  id: number;
  modelCode: string | null;
  brand: string;
  modelName: string;
  defaultCpu: string | null;
  defaultRam: string | null;
  defaultStorage: string | null;
  category: { name: string };
  _count: { assets: number };
};

export default function ModelsTable({
  models,
  isAdmin,
  q,
}: {
  models: ModelItem[];
  isAdmin: boolean;
  // Từ khoá đang tìm ở trang danh sách — gắn vào link "Sửa" để trang sửa biết
  // đường quay lại đúng kết quả tìm kiếm này sau khi lưu, thay vì rơi về
  // danh sách đầy đủ không lọc (trước đây action sau khi lưu redirect cứng
  // "/models", làm mất từ khoá đang tìm).
  q?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);

  function toggle(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedModels = models.filter((m) => selectedIds.includes(m.id));
  const columnCount = isAdmin ? 10 : 8;

  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {isAdmin && <th className="w-10 p-4"></th>}
            <th className="p-4 text-left">Model Code</th>
            <th className="p-4 text-left">Loại</th>
            <th className="p-4 text-left">Brand</th>
            <th className="p-4 text-left">Model</th>
            <th className="p-4 text-left">CPU</th>
            <th className="p-4 text-left">RAM</th>
            <th className="p-4 text-left">SSD</th>
            <th className="p-4 text-center">Số thiết bị</th>
            {isAdmin && <th className="p-4 text-right">Thao tác</th>}
          </tr>
        </thead>

        <tbody>
          {models.map((model) => (
            <tr
              key={model.id}
              className={`border-t border-slate-100 transition hover:bg-blue-50/40 ${
                selectedIds.includes(model.id) ? "bg-amber-50/60" : ""
              }`}
            >
              {isAdmin && (
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(model.id)}
                    onChange={() => toggle(model.id)}
                    className="h-4 w-4 accent-amber-600"
                    title="Chọn để gộp với model khác"
                  />
                </td>
              )}

              <td className="p-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                  {model.modelCode ?? "-"}
                </span>
              </td>

              <td className="p-4">
                <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                  {model.category.name}
                </span>
              </td>

              <td className="p-4 font-semibold text-slate-800">{model.brand}</td>

              <td className="p-4 font-medium">{model.modelName}</td>

              <td className="p-4 text-slate-600">{model.defaultCpu ?? "-"}</td>
              <td className="p-4 text-slate-600">{model.defaultRam ?? "-"}</td>
              <td className="p-4 text-slate-600">{model.defaultStorage ?? "-"}</td>

              <td className="p-4 text-center">
                <span className="inline-flex min-w-10 justify-center rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                  {model._count.assets}
                </span>
              </td>

              {isAdmin && (
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/models/${model.id}${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Edit size={16} />
                      Sửa
                    </Link>

                    {model._count.assets === 0 ? (
                      <form action={deleteModelAction}>
                        <input type="hidden" name="id" value={model.id} />
                        <ConfirmActionButton
                          label="Xoá"
                          confirmTitle="Xác nhận xoá model"
                          confirmMessage={`Bạn có chắc muốn xoá model ${model.brand} ${model.modelName}?`}
                          confirmLabel="Xoá"
                          color="rose"
                          icon={<Trash2 size={16} />}
                        />
                      </form>
                    ) : (
                      <span
                        title="Còn thiết bị đang dùng model này — chuyển/xoá hết thiết bị trước khi xoá model"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-300"
                      >
                        <Trash2 size={16} />
                        Xoá
                      </span>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}

          {models.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="p-10 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <BookOpen size={28} />
                  </div>

                  <p className="font-bold text-slate-700">
                    Không tìm thấy model phù hợp
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Thử đổi từ khóa tìm kiếm hoặc thêm model mới.
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isAdmin && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-2xl bg-slate-900 px-6 py-3 text-white shadow-2xl">
            <span className="text-sm font-semibold">
              Đã chọn {selectedIds.length} model
            </span>

            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={() => setMergeOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                selectedIds.length < 2 ? "Chọn ít nhất 2 model để gộp" : undefined
              }
            >
              <GitMerge size={16} />
              Gộp model
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"
            >
              <X size={15} />
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {mergeOpen && selectedModels.length >= 2 && (
        <MergeModelsModal models={selectedModels} onClose={() => setMergeOpen(false)} />
      )}
    </>
  );
}
