"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { createSupplyAction, type CreateSupplyState } from "./actions";

type Warehouse = { id: number; code: string; name: string };

export default function NewSupplyForm({
  regionWarehouseIds,
  warehouses,
}: {
  regionWarehouseIds: number[] | null;
  warehouses: Warehouse[];
}) {
  const [state, formAction, isPending] = useActionState<CreateSupplyState, FormData>(
    createSupplyAction,
    null
  );

  return (
    <form action={formAction}>
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
            <FormInput
              label="Mã vật tư"
              name="code"
              placeholder="VD: VT-CAP-SAC"
              required
            />

            <FormInput label="Tên vật tư" name="name" placeholder="VD: Cáp sạc USB-C" required />

            <FormInput
              label="Đơn vị tính"
              name="unit"
              placeholder="VD: cái / hộp / cuộn / mét"
              required
            />

            <FormInput
              label="Số lượng tồn kho ban đầu"
              name="quantity"
              type="number"
              placeholder="0"
            />

            <FormInput
              label="Ngưỡng cảnh báo sắp hết"
              name="minQuantity"
              type="number"
              placeholder="VD: 5 (để 0 nếu không cần cảnh báo)"
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
                defaultValue=""
                required={Boolean(regionWarehouseIds)}
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
            className="w-full rounded-lg border px-4 py-3"
            rows={4}
            placeholder="Ghi chú thêm nếu có"
          />
        </section>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Link href="/supplies" className="rounded-lg border px-5 py-3">
          Hủy
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Đang lưu..." : "Lưu vật tư"}
        </button>
      </div>
    </form>
  );
}

function FormInput({
  label,
  name,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder?: string;
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
        placeholder={placeholder}
        required={required}
        min={type === "number" ? 0 : undefined}
        className="w-full rounded-lg border px-4 py-3"
      />
    </div>
  );
}
