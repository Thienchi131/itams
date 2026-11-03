"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function PasswordInput() {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
        <Lock size={16} />
        Mật khẩu
      </label>

      <div className="relative">
        <Lock
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          name="password"
          type={visible ? "text" : "password"}
          required
          placeholder="Nhập mật khẩu"
          className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
