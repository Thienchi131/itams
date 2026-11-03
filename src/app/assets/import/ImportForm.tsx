"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Upload } from "lucide-react";

// useFormStatus() chỉ đọc được trạng thái pending của <form> cha khi component
// gọi nó là CON của form đó (không phải chính form) — nên phải tách thành 2
// component nhỏ (nút submit + overlay) nằm bên trong <form>, không thể gộp
// logic này vào page.tsx (Server Component) được.

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Đang import...
        </>
      ) : (
        <>
          <Upload size={18} />
          Import Excel
        </>
      )}
    </button>
  );
}

function LoadingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900/60 backdrop-blur-sm">
      <Loader2 size={40} className="animate-spin text-white" />
      <p className="max-w-sm text-center text-sm font-semibold text-white">
        Đang xử lý và ghi dữ liệu... Vui lòng không tắt trang hoặc bấm lại nút
        Import.
      </p>
    </div>
  );
}

export default function ImportForm({
  action,
  children,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      {children}

      <div className="mt-6 flex justify-end">
        <SubmitButton />
      </div>

      <LoadingOverlay />
    </form>
  );
}
