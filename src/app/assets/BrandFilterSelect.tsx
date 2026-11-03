"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tag, ChevronDown, Search } from "lucide-react";

const MAX_VISIBLE = 8;

// Dropdown lọc theo Hãng (AssetModel.brand, VD Apple/Samsung/Dell/Yubico...)
// — cùng pattern combobox có ô tìm kiếm như CategoryFilterSelect/
// TeamFilterSelect (thay vì <select> gốc — <select> tự co giãn bề rộng theo
// OPTION DÀI NHẤT bên trong chứ không theo chữ đang hiển thị, từng gây lỗi
// khung "Tất cả các kho" phình to bất thường, xem WarehouseFilterSelect.tsx).
export default function BrandFilterSelect({
  brands,
  selectedBrand,
}: {
  brands: string[];
  selectedBrand: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((brand) => brand.toLowerCase().includes(q));
  }, [brands, query]);

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

  function selectBrand(brand: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (brand) {
      params.set("brand", brand);
    } else {
      params.delete("brand");
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
        <Tag size={15} className="text-blue-500" />
        <span className={selectedBrand ? "text-slate-900" : "text-slate-700"}>
          {selectedBrand ?? "Hãng"}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                placeholder="Tìm hãng..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => selectBrand(null)}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 ${
                !selectedBrand ? "bg-blue-50 font-bold text-blue-700" : "text-slate-700"
              }`}
            >
              Tất cả hãng
            </button>

            {visible.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => selectBrand(brand)}
                className={`block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 ${
                  brand === selectedBrand
                    ? "bg-blue-50 font-bold text-blue-700"
                    : "text-slate-700"
                }`}
              >
                {brand}
              </button>
            ))}

            {visible.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Không tìm thấy hãng phù hợp
              </p>
            )}

            {hiddenCount > 0 && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                Còn {hiddenCount} hãng khác — gõ thêm để lọc chính xác hơn
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
