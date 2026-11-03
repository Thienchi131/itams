"use client";

import { useActionState } from "react";
import { ArrowUpCircle, TriangleAlert } from "lucide-react";
import { stockOutSupplyAction, type SupplyTxState } from "./actions";

export default function StockOutForm({
  supplyId,
  maxQuantity,
}: {
  supplyId: number;
  maxQuantity: number;
}) {
  const [state, formAction, isPending] = useActionState<SupplyTxState, FormData>(
    stockOutSupplyAction,
    null
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6"
    >
      <input type="hidden" name="supplyId" value={supplyId} />
      <p className="mb-3 flex items-center gap-2 font-bold text-rose-700">
        <ArrowUpCircle size={18} />
        Xuất kho
      </p>

      {state?.error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-100 p-2.5 text-xs font-medium text-rose-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <input
        name="quantity"
        type="number"
        min={1}
        max={maxQuantity}
        required
        placeholder="Số lượng"
        className="mb-2 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
      />
      <input
        name="note"
        required
        placeholder="Ghi chú (lý do xuất kho)"
        className="mb-3 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Đang xử lý..." : "Xác nhận xuất"}
      </button>
    </form>
  );
}
