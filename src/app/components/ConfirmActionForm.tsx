"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";

type Color = "amber" | "rose" | "blue";
type ActionState = { error: string } | null;

export default function ConfirmActionForm({
  action,
  userId,
  label,
  title,
  message,
  confirmLabel,
  color = "blue",
  icon,
  iconOnly = false,
}: {
  // Trước đây: (formData) => Promise<void>, lỗi báo bằng throw new Error —
  // nhưng Next.js che nội dung message của lỗi throw trong Server Action ở
  // production build (chỉ hiện đầy đủ lúc "next dev"), nên người dùng chỉ
  // thấy trang lỗi chung chung không rõ lý do. Đổi qua action kiểu
  // useActionState: trả lỗi RA NHƯ DỮ LIỆU (return {error}) thay vì throw —
  // luôn hiển thị đúng, không bị Next.js che.
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  userId: number;
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  color?: Color;
  icon?: React.ReactNode;
  // Chỉ hiện icon (label chuyển thành tooltip qua title) — dùng khi 1 hàng
  // có nhiều nút thao tác cạnh nhau, tránh bảng bị vỡ bố cục/tràn ngang.
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  // Các action dùng ở đây (reset password/reset 2FA/xoá tài khoản) không
  // redirect sang trang khác khi xong (chỉ revalidatePath rồi return null) —
  // khác với nhiều action khác trong app tự đóng modal "miễn phí" nhờ
  // navigation làm remount component. Ở đây phải tự đóng thủ công: theo dõi
  // isPending chuyển từ true -> false mà không có lỗi thì coi là vừa xử lý
  // xong thành công, tự tắt modal.
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (isPending) {
      wasPendingRef.current = true;
      return;
    }

    if (wasPendingRef.current && !state?.error) {
      setOpen(false);
    }

    wasPendingRef.current = false;
  }, [isPending, state]);

  const buttonClass =
    color === "rose"
      ? "border-rose-200 text-rose-600 hover:bg-rose-50"
      : color === "amber"
      ? "border-amber-200 text-amber-600 hover:bg-amber-50"
      : "border-blue-200 text-blue-600 hover:bg-blue-50";

  // Màu nền nút xác nhận dùng inline style (thay vì class Tailwind động
  // bg-amber-500/bg-rose-600/...) vì class dựng từ biến đôi khi không được
  // Tailwind biên dịch kịp trong dev server, khiến nút bị "trắng trơn" mất
  // màu + chữ trắng trên nền trắng nhìn như trống. Inline style luôn hiển
  // thị đúng bất kể cache/compile của Tailwind.
  const CONFIRM_COLOR: Record<Color, string> = {
    rose: "#e11d48",
    amber: "#f59e0b",
    blue: "#2563eb",
  };

  return (
    <>
      <form id={formId} action={formAction}>
        <input type="hidden" name="userId" value={userId} />

        <button
          type="button"
          onClick={() => setOpen(true)}
          title={iconOnly ? label : undefined}
          className={
            iconOnly
              ? `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${buttonClass}`
              : `inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold transition ${buttonClass}`
          }
        >
          {icon}
          {!iconOnly && label}
        </button>
      </form>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
              <h2 className="text-center text-3xl font-extrabold text-slate-900">
                {title}
              </h2>

              <p className="mt-5 text-center text-lg leading-8 text-slate-600">
                {message}
              </p>

              {state?.error && (
                <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm font-medium text-rose-700">
                  <TriangleAlert size={18} className="mt-0.5 shrink-0" />
                  <span>{state.error}</span>
                </div>
              )}

              <div className="mt-8 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-lg font-bold text-slate-900 hover:bg-slate-100"
                >
                  Huỷ
                </button>

                <button
                  type="submit"
                  form={formId}
                  disabled={isPending}
                  style={{ backgroundColor: CONFIRM_COLOR[color] }}
                  className="rounded-2xl px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Đang xử lý..." : confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}