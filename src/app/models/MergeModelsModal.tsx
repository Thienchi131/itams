"use client";

import { useState } from "react";
import { mergeModelsAction } from "./actions";
import SubmitButton from "../components/SubmitButton";

type ModelItem = {
  id: number;
  modelCode: string | null;
  brand: string;
  modelName: string;
  _count: { assets: number };
};

export default function MergeModelsModal({
  models,
  onClose,
}: {
  models: ModelItem[];
  onClose: () => void;
}) {
  // Mặc định gợi ý giữ lại model có nhiều thiết bị nhất — thường là bản
  // "đúng"/đang được dùng nhiều, đỡ phải tự soi. Admin vẫn đổi được tuỳ ý.
  const suggestedPrimaryId = [...models].sort(
    (a, b) => b._count.assets - a._count.assets
  )[0]?.id;

  const [primaryId, setPrimaryId] = useState(suggestedPrimaryId);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <h2 className="text-2xl font-extrabold text-slate-900">Gộp model trùng</h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Chọn model muốn <strong>giữ lại</strong>. Toàn bộ thiết bị đang thuộc
          các model còn lại sẽ được chuyển sang model này, sau đó các model đó
          sẽ bị <strong>xoá vĩnh viễn</strong> (Model Code của chúng sẽ không
          còn dùng được nữa).
        </p>

        <form action={mergeModelsAction} className="mt-5 space-y-2">
          <input type="hidden" name="ids" value={models.map((m) => m.id).join(",")} />

          {models.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 has-[:checked]:border-amber-500 has-[:checked]:ring-2 has-[:checked]:ring-amber-200"
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="primaryId"
                  value={m.id}
                  checked={primaryId === m.id}
                  onChange={() => setPrimaryId(m.id)}
                />
                <span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    {m.modelCode ?? "(chưa có mã)"}
                  </span>{" "}
                  <span className="font-semibold text-slate-900">
                    {m.brand} {m.modelName}
                  </span>
                </span>
              </span>

              <span className="text-sm font-semibold text-emerald-700">
                {m._count.assets} thiết bị
              </span>
            </label>
          ))}

          <div className="mt-8 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-lg font-bold text-slate-900 transition hover:bg-slate-100"
            >
              Huỷ
            </button>

            <SubmitButton
              pendingText="Đang gộp..."
              className="rounded-2xl bg-amber-600 px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-amber-700"
            >
              Gộp model
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
