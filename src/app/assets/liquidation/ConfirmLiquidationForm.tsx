"use client";

import { useActionState, useEffect } from "react";
import { showToast } from "@/lib/flash";
import { TriangleAlert, Trash2 } from "lucide-react";
import { confirmLiquidationAction, type LiquidationActionState } from "./actions";
import ConfirmActionButton from "../../components/ConfirmActionButton";

export default function ConfirmLiquidationForm({ assetId }: { assetId: number }) {
  const [state, formAction] = useActionState<LiquidationActionState, FormData>(
    confirmLiquidationAction,
    null
  );

  // Action không redirect -> tự hiện toast khi trả về success.
  useEffect(() => {
    if (state?.success) showToast(state.success);
  }, [state]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="assetId" value={assetId} />

      <ConfirmActionButton
        label="Thanh lý"
        confirmTitle="Xác nhận đã thanh lý?"
        confirmMessage="Thiết bị sẽ được đánh dấu Đã thanh lý (đã bán/huỷ thật sự), ghi lại ngày và người xác nhận. Không thể hoàn tác."
        confirmLabel="Thanh lý"
        color="rose"
        icon={<Trash2 size={14} />}
      />

      {state?.error && (
        <span className="flex items-center gap-1 text-xs font-medium text-rose-600">
          <TriangleAlert size={12} />
          {state.error}
        </span>
      )}
    </form>
  );
}
