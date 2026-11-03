"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Nút submit dùng chung cho MỌI form Lưu/Tạo mới/Cập nhật trong app — tự
 * disable + đổi sang trạng thái "Đang lưu..." (spinner) trong lúc form đang
 * xử lý, để chặn user bấm nhiều lần liên tục gây gửi trùng request (VD: tạo
 * trùng 2 bản ghi, hoặc 2 request cùng sửa 1 dòng chạy đè lên nhau).
 *
 * 2 cách dùng:
 *   1. Bên trong Client Component đã tự gọi useActionState() và có sẵn
 *      isPending — truyền thẳng qua prop `pending` để dùng chung đúng giá
 *      trị đó, không cần đọc lại qua context của <form>:
 *        const [state, formAction, isPending] = useActionState(...);
 *        <SubmitButton pending={isPending} className="...">Lưu</SubmitButton>
 *
 *   2. Bên trong page.tsx (Server Component) chỉ có <form action={...}> đơn
 *      thuần, không có state gì để truyền — không truyền prop `pending`,
 *      component tự đọc qua useFormStatus() (BẮT BUỘC SubmitButton phải nằm
 *      LÀ CON của thẻ <form>, không phải chính nó, đúng như quy tắc của
 *      useFormStatus):
 *        <form action={someAction}>
 *          ...
 *          <SubmitButton className="...">Lưu</SubmitButton>
 *        </form>
 */
export default function SubmitButton({
  children,
  pendingText = "Đang lưu...",
  className = "",
  icon,
  pending: pendingProp,
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  icon?: React.ReactNode;
  // Truyền tay nếu component cha đã có sẵn isPending từ useActionState —
  // nếu không truyền, tự đọc từ <form> cha gần nhất qua useFormStatus().
  pending?: boolean;
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {pendingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
