"use client";

import { useActionState, useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import {
  rejectWarehouseTransferAction,
  type AssetActionState,
} from "../[id]/actions";

// Modal "Từ chối" — bắt buộc nêu lý do (VD chọn nhầm kho đích, hàng chưa
// thực gửi, sai thiết bị...). Sau khi từ chối, thiết bị trả về đúng
// trạng thái/kho nguồn như trước khi luân chuyển, và IT kho nguồn sẽ thấy
// lại qua chuông thông báo (NotificationBell đọc AssetHistory theo đúng
// kho của họ) — xem ghi chú đầy đủ ở rejectWarehouseTransferAction.
export default function RejectTransferModal({
  assetId,
  assetTag,
  returnTo,
}: {
  assetId: number;
  assetTag: string;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, isPending] = useActionState<
    AssetActionState,
    FormData
  >(rejectWarehouseTransferAction, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
      >
        <X size={15} />
        Từ chối
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">
              Từ chối nhận — {assetTag}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Thiết bị sẽ được trả về đúng kho/trạng thái trước khi luân
              chuyển. Kho gửi sẽ được báo lại lý do qua chuông thông báo.
            </p>

            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="assetId" value={assetId} />
              <input type="hidden" name="returnTo" value={returnTo ?? ""} />

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Lý do từ chối <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="reason"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Chọn nhầm kho đích, chưa nhận được hàng thực tế..."
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                  rows={3}
                />
              </div>

              {state?.error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  <TriangleAlert size={15} className="shrink-0" />
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
