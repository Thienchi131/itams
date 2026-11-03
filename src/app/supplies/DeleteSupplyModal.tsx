"use client";

import { useActionState, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { deleteSupplyAction } from "./[id]/actions";
import type { SupplyTxState } from "./[id]/actions";

export default function DeleteSupplyModal({
  supplyId,
  quantity,
  unit,
  label,
}: {
  supplyId: number;
  quantity: number;
  unit: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, isPending] = useActionState<SupplyTxState, FormData>(
    deleteSupplyAction,
    null
  );

  // Còn tồn kho thật ngoài đời — không cho xoá, tránh mất "sổ sách" của số
  // lượng vẫn còn tồn tại. Giống pattern nút Xoá bị mờ ở Model Library khi
  // model còn thiết bị đang dùng.
  if (quantity !== 0) {
    return (
      <span
        title={`Còn tồn kho ${quantity} ${unit} — xuất hết tồn kho trước khi xoá vật tư`}
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-300"
      >
        <Trash2 size={16} />
        Xoá
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 font-semibold text-rose-600 hover:bg-rose-50"
      >
        <Trash2 size={16} />
        Xoá
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">
              Xoá vĩnh viễn vật tư
            </h3>

            <p className="mt-2 text-sm text-slate-500">{label}</p>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Hành động này KHÔNG thể hoàn tác. Toàn bộ lịch sử nhập/xuất
                của vật tư sẽ bị xoá vĩnh viễn khỏi hệ thống. Chỉ dùng khi vật
                tư được tạo nhầm/tạo trùng mã.
              </span>
            </div>

            <form action={formAction} className="mt-5">
              <input type="hidden" name="supplyId" value={supplyId} />

              <label className="block text-sm font-semibold text-slate-700">
                Lý do xoá <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Tạo trùng mã vật tư, tạo nhầm lúc khởi tạo danh mục..."
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                rows={3}
              />

              {state?.error && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  <TriangleAlert size={15} className="shrink-0" />
                  {state.error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Huỷ
                </button>

                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {isPending ? "Đang xoá..." : "Xác nhận xoá"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
