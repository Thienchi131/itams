"use client";

import type { WarehouseOption } from "@/modules/warehouse/return-destination";

// Ô "Nhập về kho" trong form thu hồi — chỉ hiện khi người thao tác phụ trách
// từ 2 kho trở lên (1 kho thì không có gì để chọn, server tự dùng kho đó).
export default function ReturnWarehouseSelect({
  options,
  defaultWarehouseId,
}: {
  options: WarehouseOption[];
  defaultWarehouseId: number | null;
}) {
  if (options.length < 2) return null;

  return (
    <div>
      <label htmlFor="returnWarehouseId" className="block text-sm font-medium">
        Nhập về kho
      </label>
      <select
        id="returnWarehouseId"
        name="returnWarehouseId"
        required
        defaultValue={defaultWarehouseId ?? ""}
        className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
      >
        <option value="" disabled>
          Chọn kho nhận thiết bị
        </option>
        {options.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} - {w.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-400">
        Chọn đúng kho nơi thiết bị thực tế được nhận lại.
      </p>
    </div>
  );
}
