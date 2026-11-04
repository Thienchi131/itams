"use client";

import { useState } from "react";
import type { AssetModelTag } from "@prisma/client";
import { updateModelTagAction } from "./actions";
import { showToast } from "@/lib/flash";

type Model = {
  id: number;
  categoryName: string;
  brand: string;
  modelName: string;
  modelCode: string | null;
  tag: AssetModelTag | null;
};

// Mỗi dòng là 1 <form action={...}> riêng, tự submit ngay khi đổi lựa chọn
// (onChange gọi requestSubmit()) — không cần nút "Lưu" riêng, đúng kiểu
// "gán hàng loạt nhanh" cho danh sách có thể dài hàng chục/hàng trăm model.
// Dùng action={fn} trực tiếp (như EntryRow.tsx ở ip-whitelist) thay vì
// useActionState — trang chỉ cần Next.js tự refresh Server Component sau
// khi submit xong, không cần optimistic/pending state phức tạp.
//
// QUAN TRỌNG: <select> ở đây PHẢI controlled (value + onChange cập nhật
// state cục bộ) — KHÔNG được dùng defaultValue (uncontrolled). Từng bị bug:
// React 19 tự động RESET các field uncontrolled trong <form> ngay sau khi
// action chạy xong thành công (giống form.reset() của HTML gốc), nên chọn
// tag xong dropdown tự nhảy lại về "— Không gắn —" ngay lập tức dù DB đã
// lưu đúng — phải chuyển trang đi rồi vào lại mới thấy tag đúng (lúc đó
// Server Component render lại từ đầu với data mới, không còn bị reset che
// mất). Chuyển sang controlled thì React không còn gì để "reset" nữa —
// dropdown giữ nguyên lựa chọn vừa chọn ngay khi submit xong.
export default function ModelTagRow({ model }: { model: Model }) {
  const [tag, setTag] = useState<AssetModelTag | "">(model.tag ?? "");

  return (
    <tr className="border-t border-slate-100 transition hover:bg-blue-50/40">
      <td className="p-4 text-slate-600">{model.categoryName}</td>

      <td className="p-4 font-medium text-slate-900">
        {model.brand} {model.modelName}
      </td>

      <td className="p-4 text-slate-500">{model.modelCode || "—"}</td>

      <td className="p-4">
        <form
          action={async (formData) => {
            await updateModelTagAction(formData);
            showToast(`Đã cập nhật tag cho ${model.modelCode || model.modelName}.`);
          }}
        >
          <input type="hidden" name="id" value={model.id} />
          <select
            name="tag"
            value={tag}
            onChange={(e) => {
              const next = e.target.value as AssetModelTag | "";
              setTag(next);
              e.currentTarget.form?.requestSubmit();
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">— Không gắn —</option>
            <option value="OK">🆗 Cấp phát được</option>
            <option value="BACKUP">🅱️ Backup</option>
          </select>
        </form>
      </td>
    </tr>
  );
}
