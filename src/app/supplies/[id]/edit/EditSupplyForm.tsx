"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { updateSupplyAction, type UpdateSupplyState } from "./actions";

type Warehouse = { id: number; code: string; name: string };

type Supply = {
  id: number;
  code: string;
  name: string;
  unit: string;
  minQuantity: number;
  note: string | null;
  warehouseId: number | null;
};

export default function EditSupplyForm({
  supply,
  regionWarehouseIds,
  warehouses,
}: {
  supply: Supply;
  regionWarehouseIds: number[] | null;
  warehouses: Warehouse[];
}) {
  const [state, formAction, isPending] = useActionState<UpdateSupplyState, FormData>(
    updateSupplyAction,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={supply.id} />

      {state?.error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-xl border bg-white p-6">
          <h3 className="mb-5 text-lg font-semibold">Thông tin vật tư</h3>

          <div className="grid grid-cols-2 gap-5">
            <FormInput label="Mã vật tư" name="code" defaultValue={supply.code} required />

            <FormInput label="Tên vật tư" name="name" defaultValue={supply.name} required />

            <FormInput label="Đơn vị tính" name="unit" defaultValue={supply.unit} required />

            <FormInput
              label="Ngưỡng cảnh báo sắp hết"
              name="minQuantity"
              type="number"
              defaultValue={String(supply.minQuantity)}
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Kho
                {regionWarehouseIds && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    (chỉ chọn được trong khu vực bạn phụ trách)
                  </span>
                )}
              </label>

              <select
                name="warehouseId"
                defaultValue={supply.warehouseId ?? ""}
                className="w-full rounded-lg border px-4 py-3"
              >
                {!regionWarehouseIds && <option value="">-- Không thuộc kho nào --</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6">
          <h3 className="mb-5 text-lg font-semibold">Ghi chú</h3>

          <textarea
            name="note"
            defaultValue={supply.note ?? ""}
            className="w-full rounded-lg border px-4 py-3"
            rows={4}
          />
        </section>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Link href={`/supplies/${supply.id}`} className="rounded-lg border px-5 py-3">
          Hủy
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

function FormInput({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={type === "number" ? 0 : undefined}
        className="w-full rounded-lg border px-4 py-3"
      />
    </div>
  );
}
