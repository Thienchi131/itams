"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { returnAssetAction, type AssetActionState } from "./actions";
import ReturnWarehouseSelect from "@/app/components/ReturnWarehouseSelect";
import type { WarehouseOption } from "@/modules/warehouse/return-destination";

export default function ReturnAssetModal({
  assetId,
  returnTo,
  warehouseOptions = [],
  defaultWarehouseId = null,
}: {
  assetId: number;
  returnTo?: string;
  warehouseOptions?: WarehouseOption[];
  defaultWarehouseId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<AssetActionState, FormData>(
    returnAssetAction,
    null
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border px-4 py-2 text-sm"
      >
        Thu hồi về kho
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold">Xác nhận thu hồi thiết bị</h3>

            <p className="mt-2 text-sm text-slate-500">
              Thiết bị sẽ được chuyển về trạng thái Trong kho và xóa người đang sử dụng.
            </p>

            <form action={formAction} className="mt-5">
              <input type="hidden" name="assetId" value={assetId} />
              <input type="hidden" name="returnTo" value={returnTo ?? ""} />

              {state?.error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  <TriangleAlert size={15} className="shrink-0" />
                  {state.error}
                </div>
              )}

              <label className="text-sm font-medium">Lý do thu hồi</label>
              <select
                name="returnReason"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
              >
                <option value="">Chọn lý do</option>
                <option value="Nhân viên nghỉ việc">Nhân viên nghỉ việc</option>
                <option value="Cấp đổi thiết bị">Cấp đổi thiết bị</option>
                <option value="Thiết bị hư hỏng">Thiết bị hư hỏng</option>
                <option value="Khác">Khác</option>
              </select>

              <div className="mt-4">
                <ReturnWarehouseSelect
                  options={warehouseOptions}
                  defaultWarehouseId={defaultWarehouseId}
                />
              </div>

              <label className="mt-4 block text-sm font-medium">
                Phụ kiện đi kèm khi trả
              </label>
              <div className="mt-2 flex gap-6 rounded-lg border px-4 py-3 text-sm">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    name="hasAdapter"
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 accent-blue-600"
                  />
                  Có Adapter
                </label>

                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    name="hasCable"
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 accent-blue-600"
                  />
                  Có dây sạc
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Bỏ tick nếu thiếu — sẽ được ghi rõ trong timeline của thiết bị.
              </p>

              <label className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                <input
                  name="sendToRepair"
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                />
                Gửi sửa chữa/bảo hành ngay (thay vì đưa về Trong kho)
              </label>

              <label className="mt-4 block text-sm font-medium">
                Ghi chú
              </label>
              <textarea
                name="returnNote"
                className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
                placeholder="Nhập ghi chú nếu có"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Đang xử lý..." : "Xác nhận thu hồi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}