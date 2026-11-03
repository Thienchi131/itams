"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserRound, Check } from "lucide-react";

type Employee = {
  id: number;
  employeeCode: string;
  fullName: string;
  team?: {
    name: string;
  } | null;
};

type EmployeeSelectProps = {
  employees: Employee[];
  name?: string;
  onEmployeeChange?: (employee: Employee) => void;
  // Bắn ra mỗi khi lựa chọn thay đổi, kể cả khi bị huỷ (null) — dùng để
  // component cha biết chính xác lúc nào KHÔNG có nhân viên nào được chọn
  // hợp lệ (VD: user gõ tên lạ rồi bấm nút hành động mà không chọn từ danh
  // sách gợi ý), để hiện cảnh báo thay vì để lọt xuống server action.
  onSelectedChange?: (employee: Employee | null) => void;
  hasError?: boolean;
  // Cho phép component CHA áp SẴN 1 lựa chọn ngay từ đầu (VD: vừa tạo nhanh 1
  // nhân viên mới qua popup "Tạo nhanh" trong phiếu nhập kho). Chỉ đọc lúc
  // MOUNT (giá trị khởi tạo state, không phải state đồng bộ theo prop) — cha
  // muốn áp lựa chọn MỚI thì phải tự đổi `key` của EmployeeSelect (ép remount
  // sạch) thay vì chỉ đổi prop này, xem cách dùng ở StockInForm.tsx. Không
  // dùng cho 2 chỗ khác đang dùng EmployeeSelect, bỏ trống là đủ, hành vi giữ
  // nguyên như cũ.
  initialSelected?: Employee | null;
};

export default function EmployeeSelect({
  employees,
  name = "employeeId",
  onEmployeeChange,
  onSelectedChange,
  hasError,
  initialSelected = null,
}: EmployeeSelectProps) {
  const [keyword, setKeyword] = useState(initialSelected?.fullName ?? "");
  const [selected, setSelected] = useState<Employee | null>(initialSelected);
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filtered = useMemo(() => {
    const key = keyword.toLowerCase();

    return employees.filter((emp) => {
      const text =
        `${emp.employeeCode} ${emp.fullName} ${emp.team?.name ?? ""}`.toLowerCase();

      return text.includes(key);
    });
  }, [employees, keyword]);

  return (
    <div className="mt-5 space-y-3" ref={ref}>
      <input
        type="hidden"
        name={name}
        value={selected?.id ?? ""}
      />

      {/* Search */}
      <input
        type="text"
        value={keyword}
        placeholder="Tìm theo mã hoặc tên nhân viên..."
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setKeyword(e.target.value);
          setOpen(true);

          // Gõ lại sau khi đã chọn (hoặc gõ 1 tên không có trong danh sách)
          // thì huỷ lựa chọn cũ — tránh trường hợp hidden input vẫn giữ ID
          // nhân viên cũ trong khi ô hiển thị lại là 1 cái tên khác/không
          // hợp lệ.
          if (selected) {
            setSelected(null);
            onSelectedChange?.(null);
          }
        }}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:ring-4 ${
          hasError
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
            : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
        }`}
      />

      {/* Selected employee */}
      {selected && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <UserRound
                  size={18}
                  className="text-blue-600"
                />
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  {selected.fullName}
                </p>

                <p className="text-xs text-slate-500">
                  {selected.employeeCode}
                  {selected.team ? ` • ${selected.team.name}` : ""}
                </p>
              </div>
            </div>

            <Check
              size={20}
              className="text-emerald-600"
            />
          </div>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Không tìm thấy nhân viên
            </div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  setSelected(emp);
                  setKeyword(emp.fullName);
                  setOpen(false);
                  onEmployeeChange?.(emp);
                  onSelectedChange?.(emp);
                }}
                className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-blue-50 last:border-0"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <UserRound
                    size={18}
                    className="text-slate-600"
                  />
                </div>

                <div className="flex-1">
                  <p className="font-semibold text-slate-900">
                    {emp.fullName}
                  </p>

                  <p className="text-xs text-slate-500">
                    {emp.employeeCode}
                  </p>

                  <p className="text-xs text-blue-600">
                    {emp.team?.name ?? "-"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}