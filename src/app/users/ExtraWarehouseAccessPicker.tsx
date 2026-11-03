"use client";

import { useState } from "react";

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

type Region = {
  id: number;
  name: string;
  warehouses: Warehouse[];
};

// Danh sách kho BỔ SUNG, tách biệt hoàn toàn khỏi UserScopeSelect ở trên —
// dùng cho case 1 user cần xem 1 tổ hợp kho tuỳ ý CẮT NGANG nhiều Region
// khác nhau (VD kế toán cần kho ở khu vực Dubai + kho ở khu vực Lào cùng
// lúc), mà không muốn gộp các Region đó lại (ảnh hưởng phân quyền của Lead
// đang phụ trách riêng từng Region). Có thể dùng ĐỘC LẬP (bỏ trống
// UserScopeSelect ở trên = "Tất cả", rồi tick đúng các kho cần ở đây → phạm
// vi xem sẽ CHỈ còn đúng các kho đã tick, không phải "Tất cả" nữa) hoặc kết
// hợp thêm vào 1 Region/Warehouse đã chọn ở trên.
export default function ExtraWarehouseAccessPicker({
  regions,
  unassignedWarehouses,
  defaultSelectedIds,
}: {
  regions: Region[];
  unassignedWarehouses: Warehouse[];
  defaultSelectedIds: number[];
}) {
  const [selected, setSelected] = useState<number[]>(defaultSelectedIds);

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div>
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-4">
        {regions.map((region) => (
          <div key={region.id}>
            <p className="mb-1.5 text-xs font-bold uppercase text-slate-400">
              {region.name}
            </p>

            <div className="flex flex-wrap gap-2">
              {region.warehouses.map((warehouse) => (
                <label
                  key={warehouse.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700"
                >
                  <input
                    type="checkbox"
                    name="extraWarehouseIds"
                    value={warehouse.id}
                    checked={selected.includes(warehouse.id)}
                    onChange={() => toggle(warehouse.id)}
                    className="h-3.5 w-3.5 accent-blue-600"
                  />
                  {warehouse.code} - {warehouse.name}
                </label>
              ))}
            </div>
          </div>
        ))}

        {unassignedWarehouses.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-slate-400">
              Chưa gán khu vực
            </p>

            <div className="flex flex-wrap gap-2">
              {unassignedWarehouses.map((warehouse) => (
                <label
                  key={warehouse.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700"
                >
                  <input
                    type="checkbox"
                    name="extraWarehouseIds"
                    value={warehouse.id}
                    checked={selected.includes(warehouse.id)}
                    onChange={() => toggle(warehouse.id)}
                    className="h-3.5 w-3.5 accent-blue-600"
                  />
                  {warehouse.code} - {warehouse.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-xs text-slate-400">
        Kho bổ sung ngoài phạm vi ở trên — kết hợp thêm được với &quot;Toàn bộ
        khu vực&quot;/&quot;Chỉ kho...&quot;, hoặc dùng ĐỘC LẬP: nếu để phạm vi
        ở trên là &quot;Tất cả&quot; nhưng vẫn tick kho ở đây, tài khoản sẽ
        CHỈ thấy đúng các kho đã tick (không phải tất cả nữa). Dùng cho user
        cần xem nhiều kho rải rác không chung 1 khu vực (VD kế toán).
      </p>
    </div>
  );
}
