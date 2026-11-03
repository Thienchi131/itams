"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import {
  confirmWarehouseTransferAction,
  type AssetActionState,
} from "../[id]/actions";
import ConfirmActionButton from "../../components/ConfirmActionButton";

export default function ConfirmTransferButton({
  assetId,
  assetTag,
  toWarehouseLabel,
  returnTo,
}: {
  assetId: number;
  assetTag: string;
  toWarehouseLabel: string;
  returnTo?: string;
}) {
  const [state, formAction] = useActionState<AssetActionState, FormData>(
    confirmWarehouseTransferAction,
    null
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />

      <ConfirmActionButton
        label="Xác nhận nhập kho"
        confirmTitle="Xác nhận đã nhận thiết bị?"
        confirmMessage={`Thiết bị ${assetTag} sẽ chính thức chuyển vào kho ${toWarehouseLabel}.`}
        confirmLabel="Xác nhận"
        color="blue"
        icon={<Check size={15} />}
      />

      {state?.error && (
        <p className="mt-1 text-xs font-medium text-rose-600">{state.error}</p>
      )}
    </form>
  );
}
