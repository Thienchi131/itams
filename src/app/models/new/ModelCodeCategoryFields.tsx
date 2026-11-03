"use client";

import { useState } from "react";
import SmartSelect from "../[id]/SmartSelect";

// Tiền tố Model Code tự điền theo Loại thiết bị. Loại nào không có trong
// danh sách này thì để trống, người dùng tự gõ như cũ.
const CATEGORY_CODE_PREFIX: Record<string, string> = {
  MacBook: "MB",
  iPhone: "IP",
  "Điện thoại": "ĐT",
  YubiKey: "YBK",
  "Màn hình": "MH",
  iPad: "IPD",
  Laptop: "LT",
  Wacom: "WA",
};

export default function ModelCodeCategoryFields({
  categoryOptions,
}: {
  categoryOptions: string[];
}) {
  const [modelCode, setModelCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  function handleCategoryChange(category: string) {
    const prefix = CATEGORY_CODE_PREFIX[category];

    if (prefix && !codeTouched) {
      setModelCode(prefix);
    }
  }

  return (
    <>
      <SmartSelect
        label="Loại thiết bị"
        name="category"
        options={categoryOptions}
        required
        onChange={handleCategoryChange}
      />

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Model Code
        </label>

        <input
          name="modelCode"
          value={modelCode}
          onChange={(e) => {
            // Tự viết hoa ngay lúc gõ — Model Code luôn được chuẩn hoá thành
            // chữ hoa lúc lưu (xem actions.ts), viết hoa ngay ở đây để người
            // dùng thấy đúng giá trị sẽ được lưu, tránh hiểu nhầm/gõ lẫn.
            setModelCode(e.target.value.toUpperCase());
            setCodeTouched(true);
          }}
          placeholder="Ví dụ: MBP14M4"
          className="w-full rounded-lg border px-4 py-3 uppercase placeholder:normal-case"
        />
      </div>
    </>
  );
}
