"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter } from "lucide-react";
import type { AssetStatus } from "@prisma/client";

// Dropdown lọc theo Trạng thái vận hành ngay trên trang Quản lý tài sản —
// trước đây chỉ lọc được qua link cứng từ Dashboard (VD bấm thẻ "Chưa được
// cấp phát"), không có cách nào tự chọn trạng thái ngay tại đây.
export default function StatusFilterSelect({
  statusOptions,
  selectedStatus,
}: {
  statusOptions: { value: AssetStatus; label: string }[];
  selectedStatus: AssetStatus | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    // Đổi filter thì reset về trang 1 — tránh đứng ở trang lẻ vượt quá tổng
    // số trang của tập kết quả mới.
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="relative">
      <ListFilter
        size={15}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
      />

      <select
        value={selectedStatus ?? ""}
        onChange={handleChange}
        className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500"
      >
        <option value="">Trạng thái</option>
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
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
