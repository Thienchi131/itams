"use client";

import { useActionState, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { deleteAssetAction, type AssetActionState } from "./actions";

export default function DeleteAssetModal({
  assetId,
  assetLabel,
  returnTo,
}: {
  assetId: number;
  assetLabel: string;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, isPending] = useActionState<
    AssetActionState,
    FormData
  >(deleteAssetAction, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100"
      >
        <Trash2 size={16} />
        Xoá tài sản
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">
              Xoá vĩnh viễn thiết bị
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {assetLabel}
            </p>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Hành động này KHÔNG thể hoàn tác. Toàn bộ lịch sử, phụ kiện đi
                kèm và dữ liệu liên quan của thiết bị sẽ bị xoá vĩnh viễn khỏi
                hệ thống. Chỉ dùng khi thiết bị được nhập nhầm/nhập trùng —
                nếu thiết bị vẫn còn dùng thực tế, hãy chuyển kho/thu hồi thay
                vì xoá.
              </span>
            </div>

            <form action={formAction} className="mt-5">
              <input type="hidden" name="assetId" value={assetId} />
              <input type="hidden" name="returnTo" value={returnTo ?? ""} />

              <label className="block text-sm font-semibold text-slate-700">
                Lý do xoá <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Nhập sai Asset Tag/Serial lúc nhập kho, tạo lại bản ghi đúng thay thế..."
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
