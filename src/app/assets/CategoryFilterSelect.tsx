"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChevronDown, Search } from "lucide-react";

type Category = {
  id: number;
  name: string;
};

const MAX_VISIBLE = 8;

// Dropdown lọc theo Loại thiết bị (AssetCategory, gán trên AssetModel) — VD
// Laptop/Phone/Monitor... Cùng pattern combobox có ô tìm kiếm như
// TeamFilterSelect, vì danh sách loại thiết bị cũng có thể khá dài.
export default function CategoryFilterSelect({
  categories,
  selectedCategoryId,
}: {
  categories: Category[];
  selectedCategoryId: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(q)
    );
  }, [categories, query]);

  const visible = filtered.slice(0, MAX_VISIBLE);
  const hiddenCount = filtered.length - visible.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCategory(categoryId: number | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (categoryId) {
      params.set("categoryId", String(categoryId));
    } else {
      params.delete("categoryId");
    }
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);

    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-2.5 pl-4 pr-3.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:border-blue-500"
      >
        <Boxes size={15} className="text-blue-500" />
        <span className={selected ? "text-slate-900" : "text-slate-700"}>
          {selected ? selected.name : "Loại thiết bị"}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm loại thiết bị..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 ${
                !selected ? "bg-blue-50 font-bold text-blue-700" : "text-slate-700"
              }`}
            >
              Tất cả loại thiết bị
            </button>

            {visible.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => selectCategory(category.id)}
                className={`block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 ${
                  category.id === selectedCategoryId
                    ? "bg-blue-50 font-bold text-blue-700"
                    : "text-slate-700"
                }`}
              >
                {category.name}
              </button>
            ))}

            {visible.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Không tìm thấy loại thiết bị phù hợp
              </p>
            )}

            {hiddenCount > 0 && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                Còn {hiddenCount} loại khác — gõ thêm để lọc chính xác hơn
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
