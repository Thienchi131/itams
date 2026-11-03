"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function Chevron() {
  return (
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
  );
}

// Bộ chọn kỳ báo cáo (Tháng cụ thể hoặc cả Năm) — đổi giá trị nào cũng chỉ
// set/patch đúng các query param liên quan (mode/year/month), giữ nguyên
// warehouseId/regionId đang chọn sẵn trên URL.
export default function ReportPeriodSelect({
  mode,
  year,
  month,
}: {
  mode: "month" | "year";
  year: number;
  month: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = new Date().getFullYear();
  // Lùi tối đa 6 năm — đủ cho nhu cầu tra cứu báo cáo quá khứ, tránh dropdown
  // dài vô hạn với dữ liệu chưa từng tồn tại (hệ thống mới triển khai).
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  function updateParams(next: {
    mode?: "month" | "year";
    year?: number;
    month?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.mode) params.set("mode", next.mode);
    if (next.year) params.set("year", String(next.year));
    if (next.month) params.set("month", String(next.month));

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => updateParams({ mode: "month" })}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
            mode === "month"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Theo tháng
        </button>
        <button
          type="button"
          onClick={() => updateParams({ mode: "year" })}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
            mode === "year"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Theo năm
        </button>
      </div>

      {mode === "month" && (
        <div className="relative">
          <Calendar
            size={15}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
          />
          <select
            value={month}
            onChange={(e) => updateParams({ month: Number(e.target.value) })}
            className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
      )}

      <div className="relative">
        <select
          value={year}
          onChange={(e) => updateParams({ year: Number(e.target.value) })}
          className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              Năm {y}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}
