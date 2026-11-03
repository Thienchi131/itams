"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tags } from "lucide-react";

// Dropdown lọc theo tag gắn cho Model ở Cài đặt > Tag Model (🆗 Cấp phát
// được / 🅱️ Backup) — cùng pattern <select> đơn giản như StatusFilterSelect
// (chỉ 2 lựa chọn cố định, không cần combobox tìm kiếm như Brand/Category).
export default function ModelTagFilterSelect({
  selectedModelTag,
}: {
  selectedModelTag: "OK" | "BACKUP" | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set("modelTag", value);
    } else {
      params.delete("modelTag");
    }
    // Đổi filter thì reset về trang 1 — tránh đứng ở trang lẻ vượt quá tổng
    // số trang của tập kết quả mới.
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="relative">
      <Tags
        size={15}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
      />

      <select
        value={selectedModelTag ?? ""}
        onChange={handleChange}
        className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500"
      >
        <option value="">Tag Model</option>
        <option value="OK">🆗 Cấp phát được</option>
        <option value="BACKUP">🅱️ Backup</option>
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
