"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home } from "lucide-react";

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

// Dropdown lọc theo kho ở Dashboard — hỗ trợ 2 cấp: chọn NGUYÊN 1 khu vực
// (gộp số liệu tất cả kho trong khu vực đó) hoặc chọn đúng 1 kho cụ thể.
// Trước đây chỉ liệt kê phẳng từng kho, dễ gây nhầm lẫn khi 1 khu vực (VD
// "Dubai") và 1 kho cùng tên (VD "DXB - Dubai") tồn tại song song — chọn
// nhầm kho tưởng là chọn khu vực thì chỉ ra đúng data của riêng kho đó.
export default function WarehouseFilterSelect({
  regions,
  unassignedWarehouses,
  selectedWarehouseId,
  selectedRegionId,
}: {
  regions: Region[];
  unassignedWarehouses: Warehouse[];
  selectedWarehouseId: number | null;
  selectedRegionId: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentValue = selectedWarehouseId
    ? `w:${selectedWarehouseId}`
    : selectedRegionId
      ? `r:${selectedRegionId}`
      : "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    params.delete("warehouseId");
    params.delete("regionId");
    // Đổi phạm vi xem thì reset về trang 1 — trang cũ có thể vượt quá tổng
    // số trang của tập dữ liệu mới, đứng ở trang bảng trống rất dễ hiểu nhầm
    // là "kho này/khu vực này không có gì".
    params.delete("page");

    if (value.startsWith("w:")) {
      params.set("warehouseId", value.slice(2));
    } else if (value.startsWith("r:")) {
      params.set("regionId", value.slice(2));
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="relative">
      <Home
        size={15}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
      />

      {/* w-48 + truncate: KHÔNG để select tự co giãn theo option — trình
          duyệt (Chrome) tính bề rộng select theo OPTION DÀI NHẤT trong danh
          sách (VD "Toàn bộ khu vực ..." hoặc tên kho dài), không phải theo
          chữ đang hiển thị ("Tất cả các kho"), khiến khung này phình to hơn
          hẳn 3 dropdown lọc bên cạnh dù chữ hiện ra ngắn hơn. Ép cứng bề rộng
          để đồng bộ hàng, phần chữ dài quá sẽ tự cắt "..." (title vẫn còn
          nguyên trong <option>, chỉ khung hiển thị bị giới hạn). */}
      <select
        value={currentValue}
        onChange={handleChange}
        className="w-36 appearance-none truncate rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500"
      >
      <option value="">Kho</option>

      {regions.map((region) => (
        <optgroup key={region.id} label={region.name}>
          <option value={`r:${region.id}`}>Toàn bộ khu vực {region.name}</option>

          {region.warehouses.map((warehouse) => (
            <option key={warehouse.id} value={`w:${warehouse.id}`}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </optgroup>
      ))}

      {unassignedWarehouses.length > 0 && (
        <optgroup label="Chưa gán khu vực">
          {unassignedWarehouses.map((warehouse) => (
            <option key={warehouse.id} value={`w:${warehouse.id}`}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </optgroup>
      )}
      </select>

      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <path
          d="M2.5 4.5L6 8L9.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
