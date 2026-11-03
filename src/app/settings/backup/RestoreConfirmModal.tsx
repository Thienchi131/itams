"use client";

import { useActionState, useState } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import SubmitButton from "@/app/components/SubmitButton";
import type { BackupActionState } from "./actions";

const CONFIRM_PHRASE = "KHOI PHUC";

// Modal xác nhận dùng chung cho cả 2 luồng khôi phục (từ file có sẵn trên
// server / từ file mới upload) — khác DeleteAssetModal (chỉ cần bấm nút xác
// nhận) ở chỗ đây là thao tác GHI ĐÈ TOÀN BỘ dữ liệu hệ thống, nên bắt buộc
// gõ đúng 1 cụm từ cố định mới cho bấm submit, giảm rủi ro bấm nhầm.
export default function RestoreConfirmModal({
  action,
  triggerLabel,
  triggerClassName,
  title,
  description,
  children,
}: {
  action: (
    prevState: BackupActionState,
    formData: FormData
  ) => Promise<BackupActionState>;
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, isPending] = useActionState<
    BackupActionState,
    FormData
  >(action, null);

  const isMatch = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
        }
      >
        <RotateCcw size={14} />
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-500">{description}</p>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Toàn bộ dữ liệu HIỆN TẠI trong hệ thống sẽ bị GHI ĐÈ hoàn
                toàn bằng dữ liệu trong file backup này. Hệ thống sẽ tự tạo 1
                bản backup an toàn ngay trước khi khôi phục, nhưng mọi thay
                đổi từ lúc tạo backup được chọn tới hiện tại vẫn sẽ mất vĩnh
                viễn nếu không khôi phục lại bản an toàn đó.
              </span>
            </div>

            <form action={formAction} className="mt-5 space-y-4">
              {children}

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Gõ chính xác{" "}
                  <span className="font-mono text-rose-600">
                    {CONFIRM_PHRASE}
                  </span>{" "}
                  để xác nhận
                </label>
                <input
                  name="confirmText"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoComplete="off"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />
              </div>

              {state?.error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  <TriangleAlert size={15} className="shrink-0" />
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Huỷ
                </button>

                <SubmitButton
                  pending={isPending}
                  disabled={!isMatch}
                  pendingText="Đang khôi phục..."
                  icon={<RotateCcw size={16} />}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                >
                  Xác nhận khôi phục
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
