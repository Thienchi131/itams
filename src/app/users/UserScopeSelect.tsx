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

// 1 tài khoản có thể được gán phạm vi xem theo 1 trong 3 mức: không giới hạn
// (Admin), cả 1 Khu vực (Lead — thấy hết mọi kho trong khu vực đó), hoặc
// đúng 1 Kho cụ thể (nhân viên chỉ phụ trách 1 kho lẻ). Dùng chung 1 dropdown
// với tiền tố "r:"/"w:" (giống WarehouseFilterSelect ở Dashboard) cho gọn,
// rồi tách ra 2 input ẩn regionId/warehouseId — cố tình chỉ 1 trong 2 có giá
// trị tại 1 thời điểm, action phía sau không cần tự xử lý loại trừ lẫn nhau.
export default function UserScopeSelect({
  regions,
  unassignedWarehouses,
  defaultRegionId,
  defaultWarehouseId,
  defaultScopeAll = false,
}: {
  regions: Region[];
  unassignedWarehouses: Warehouse[];
  defaultRegionId: number | null;
  defaultWarehouseId: number | null;
  // true = tài khoản hiện đang "xem tất cả" (không gán kho/khu vực/kho bổ
  // sung) -> dropdown chọn sẵn "Tất cả kho" thay vì placeholder. Dùng ở trang
  // Sửa; trang Tạo mới không truyền (mặc định false -> buộc chọn).
  defaultScopeAll?: boolean;
}) {
  const initialValue = defaultWarehouseId
    ? `w:${defaultWarehouseId}`
    : defaultRegionId
      ? `r:${defaultRegionId}`
      : defaultScopeAll
        ? "all"
        : "";

  const [value, setValue] = useState(initialValue);

  const regionId = value.startsWith("r:") ? value.slice(2) : "";
  const warehouseId = value.startsWith("w:") ? value.slice(2) : "";

  return (
    <div>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input-style"
      >
        <option value="" disabled>
          -- Chọn phạm vi xem --
        </option>
        <option value="all">Tất cả kho (không giới hạn)</option>

        {regions.map((region) => (
          <optgroup key={region.id} label={region.name}>
            <option value={`r:${region.id}`}>
              Toàn bộ khu vực {region.name} (Lead)
            </option>

            {region.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={`w:${warehouse.id}`}>
                Chỉ kho {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </optgroup>
        ))}

        {unassignedWarehouses.length > 0 && (
          <optgroup label="Chưa gán khu vực">
            {unassignedWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={`w:${warehouse.id}`}>
                Chỉ kho {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <input type="hidden" name="regionId" value={regionId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <input type="hidden" name="scope" value={value} />

      <p className="mt-1.5 text-xs text-slate-400">
        Bắt buộc chọn phạm vi: &quot;Toàn bộ khu vực&quot; (Lead, nhiều kho),
        &quot;Chỉ kho...&quot; (1 kho lẻ), hoặc &quot;Tất cả kho&quot; (xem
        toàn hệ thống — chỉ nên dùng cho Admin/kế toán). Cần xem nhiều kho cắt
        ngang khu vực thì để ô này ở &quot;-- Chọn phạm vi xem --&quot; rồi
        chọn tại &quot;Kho bổ sung&quot; bên dưới.
      </p>
    </div>
  );
}
