"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

type Color = "blue" | "amber" | "rose";

export default function ConfirmActionButton({
  label,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  color = "blue",
  icon,
  requirePassword = false,
  passwordLabel,
}: {
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  color?: Color;
  icon?: React.ReactNode;
  // Bật step-up: hiện ô nhập mật khẩu trong modal + gửi kèm field
  // "adminPassword" để action xác minh lại chính Admin trước khi thực hiện.
  requirePassword?: boolean;
  passwordLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  // Nút kích hoạt là type="button" (không phải submit) nên không tự có trạng
  // thái pending — đọc qua useFormStatus() của <form> cha (component này
  // luôn được đặt bên trong 1 <form>) để tự disable + đổi label lúc form đang
  // submit, chặn user bấm mở lại modal/bấm nút nhiều lần trong lúc chờ xử lý.
  const { pending } = useFormStatus();

  const buttonClass =
    color === "rose"
      ? "border-rose-200 text-rose-600 hover:bg-rose-50"
      : color === "amber"
      ? "border-amber-200 text-amber-600 hover:bg-amber-50"
      : "border-blue-200 text-blue-600 hover:bg-blue-50";

  // Xem ghi chú trong ConfirmActionForm.tsx: dùng inline style thay vì class
  // Tailwind động để tránh nút bị mất màu do cache/compile.
  const CONFIRM_COLOR: Record<Color, string> = {
    rose: "#e11d48",
    amber: "#f59e0b",
    blue: "#2563eb",
  };

  const finalConfirmLabel =
    confirmLabel || (color === "rose" ? "Xoá" : color === "amber" ? "Reset" : "Đồng ý");

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          formRef.current = e.currentTarget.closest("form");
          setOpen(true);
        }}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Đang xử lý...
          </>
        ) : (
          <>
            {icon}
            {label}
          </>
        )}
      </button>

      {requirePassword && (
        <input type="hidden" name="adminPassword" value={password} readOnly />
      )}

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-center text-3xl font-extrabold text-slate-900">
              {confirmTitle}
            </h2>

            <p className="mt-5 text-center text-lg leading-8 text-slate-600">
              {confirmMessage}
            </p>

            {requirePassword && (
              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {passwordLabel || "Nhập mật khẩu của bạn để xác nhận"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  placeholder="Mật khẩu của bạn"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPassword("");
                }}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-lg font-bold text-slate-900 transition hover:bg-slate-100"
              >
                Huỷ
              </button>

              <button
                type="button"
                disabled={requirePassword && !password}
                onClick={() => {
                  if (requirePassword && !password) return;
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
                style={{ backgroundColor: CONFIRM_COLOR[color] }}
                className="rounded-2xl px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {finalConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}