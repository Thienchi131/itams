"use client";

import { useState } from "react";

export default function SmartSelect({
  label,
  name,
  options,
  defaultValue,
  required,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string | null;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const isOther = defaultValue && !options.includes(defaultValue);
  const [selected, setSelected] = useState(isOther ? "__OTHER__" : defaultValue ?? "");

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <select
        name={`${name}Select`}
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          onChange?.(e.target.value);
        }}
        required={required}
        className="w-full rounded-lg border px-4 py-3"
      >
        <option value="">Chọn {label}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}

        <option value="__OTHER__">Khác...</option>
      </select>

      {selected === "__OTHER__" && (
        <input
          name={`${name}Other`}
          defaultValue={isOther ? defaultValue ?? "" : ""}
          placeholder={`Nhập ${label} mới`}
          required={required}
          className="mt-3 w-full rounded-lg border px-4 py-3"
        />
      )}
    </div>
  );
}