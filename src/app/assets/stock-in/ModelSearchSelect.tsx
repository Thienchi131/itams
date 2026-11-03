"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";

type ModelItem = {
  id: number;
  modelCode: string | null;
  brand: string;
  modelName: string;
  category: { name: string };
};

const MAX_VISIBLE = 10;

/**
 * Model Library có thể lên tới hàng chục/hàng trăm dòng — dùng <select> gốc
 * liệt kê hết + hiện cả CPU/RAM/Storage trong mỗi dòng gây rối mắt và khó
 * tìm. Thay bằng combobox có ô search, chỉ hiện Model Code (gọn), giới hạn
 * tối đa 10 kết quả cùng lúc — gõ thêm để lọc chính xác hơn nếu còn nhiều.
 */
export default function ModelSearchSelect({
  models,
  value,
  onChange,
}: {
  models: ModelItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = models.find((model) => String(model.id) === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return models;

    return models.filter((model) => {
      const haystack = `${model.modelCode ?? ""} ${model.brand} ${model.modelName} ${model.category.name}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [models, query]);

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

  return (
    <div ref={wrapperRef} className="relative">
      {/* select ẩn chỉ để đưa giá trị đã chọn vào FormData khi submit —
          combobox bên dưới mới là phần user thật sự nhìn/thao tác. Validate
          "bắt buộc chọn Model" được xử lý ở server action. */}
      <select
        name="modelId"
        value={value}
        onChange={() => {}}
        className="absolute h-0 w-0 opacity-0"
      >
        <option value="" />
        {selected && <option value={selected.id}>{selected.id}</option>}
      </select>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-style flex w-full items-center justify-between gap-2 text-left"
      >
        <span
          className={
            selected ? "font-semibold text-slate-900" : "text-slate-400"
          }
        >
          {selected ? selected.modelCode || selected.modelName : "Chọn Model"}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                placeholder="Tìm theo mã model, tên, brand..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {visible.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onChange(String(model.id));
                  setOpen(false);
                  setQuery("");
                }}
                className={`block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 ${
                  String(model.id) === value
                    ? "bg-blue-50 font-bold text-blue-700"
                    : "text-slate-700"
                }`}
              >
                {model.modelCode || model.modelName}
              </button>
            ))}

            {visible.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Không tìm thấy model phù hợp
              </p>
            )}

            {hiddenCount > 0 && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                Còn {hiddenCount} model khác — gõ thêm để lọc chính xác hơn
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
