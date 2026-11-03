"use client";

import { useActionState, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { transferWarehouseAction, type AssetActionState } from "./actions";

type WarehouseItem = {
  id: number;
  code: string;
  name: string;
};

export default function TransferWarehouseForm({
  assetId,
  currentWarehouseId,
  warehouses,
  returnTo,
}: {
  assetId: number;
  currentWarehouseId: number | null;
  warehouses: WarehouseItem[];
  returnTo?: string;
}) {
  // Không cho chọn lại đúng kho hiện tại — tránh tạo lịch sử "chuyển" vô
  // nghĩa (từ kho A sang kho A).
  const targetWarehouses = warehouses.filter((w) => w.id !== currentWarehouseId);

  const [toWarehouseId, setToWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, isPending] = useActionState<AssetActionState, FormData>(
    transferWarehouseAction,
    null
  );

  const selectedWarehouse = targetWarehouses.find(
    (w) => String(w.id) === toWarehouseId
  );

  function handleClick() {
    if (!toWarehouseId) {
      setError("Vui lòng chọn kho muốn chuyển đến.");
      return;
    }

    setError(null);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setConfirmOpen(false);
    submitButtonRef.current?.click();
  }

  if (targetWarehouses.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Hệ thống chỉ có 1 kho, không có kho khác để luân chuyển.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="toWarehouseId" value={toWarehouseId} />
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />

      <select
        value={toWarehouseId}
        onChange={(e) => {
          setToWarehouseId(e.target.value);
          if (e.target.value) setError(null);
        }}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
            : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
        }`}
      >
        <option value="">Chọn kho muốn chuyển đến</option>
        {targetWarehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} - {w.name}
          </option>
        ))}
      </select>

      <textarea
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú (không bắt buộc)"
        className="mt-3 min-h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />

      {(error || state?.error) && (
        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-600">
          <TriangleAlert size={15} className="shrink-0" />
          {error || state?.error}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleClick}
          className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Gửi yêu cầu chuyển kho
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900">
              Xác nhận gửi yêu cầu luân chuyển
            </h2>

            <p className="mt-3 text-slate-600">
              Gửi yêu cầu chuyển thiết bị này đến kho{" "}
              <span className="font-semibold text-slate-900">
                {selectedWarehouse
                  ? `${selectedWarehouse.code} - ${selectedWarehouse.name}`
                  : ""}
              </span>
              ? Thiết bị sẽ chuyển sang trạng thái &quot;Đang luân
              chuyển&quot; và cần IT phụ trách kho đích xác nhận nhập kho thì
              mới hoàn tất.
            </p>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-300 px-6 py-2.5 font-semibold transition hover:bg-slate-100"
              >
                Huỷ
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button ref={submitButtonRef} type="submit" className="hidden" />
    </form>
  );
}
