"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert, X } from "lucide-react";
import {
  YUBIKEY_OTP_LENGTH,
  isValidYubikeyOtp,
  modhexFromKeyCode,
  normalizeOtpInput,
} from "@/modules/auth/yubikey-otp";
import type { YubikeyActionResult } from "./yubikey-actions";

type Phase = "waiting" | "receiving" | "verifying" | "error" | "success";

// Nếu đang nhận dở mà quá thời gian này không có ký tự mới -> coi như lỗi
// (key gõ 44 ký tự chỉ mất chưa tới 1 giây).
const STALL_MS = 1500;

// Popup "Vui lòng xác nhận YubiKey": chạm key -> key gõ 44 ký tự Yubico OTP,
// popup đếm "Đang nhận x/44 ký tự", đủ 44 thì gửi server xác minh qua
// YubiCloud. Đọc phím VẬT LÝ (KeyboardEvent.code) nên bộ gõ tiếng Việt
// (Telex/VNI) hay bàn phím khác US không làm sai mã. Ô nhận phím là input
// readOnly vô hình (không bật bàn phím ảo trên điện thoại, không hiện chữ).
export default function YubikeyOtpModal({
  title,
  onSubmit,
  onClose,
}: {
  title: string;
  onSubmit: (otp: string) => Promise<YubikeyActionResult>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const stallTimerRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [message, setMessage] = useState<string | null>(null);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  useEffect(() => {
    focusInput();
    return () => {
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
    };
  }, [focusInput]);

  const reset = useCallback((nextPhase: Phase, nextMessage: string | null) => {
    bufferRef.current = "";
    setCount(0);
    setPhase(nextPhase);
    setMessage(nextMessage);
  }, []);

  const submit = useCallback(
    async (otp: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
      setPhase("verifying");
      setMessage(null);
      try {
        const res = await onSubmit(otp);
        if (res.ok) {
          setPhase("success");
          setMessage(res.message ?? "Xác minh thành công.");
          window.setTimeout(() => {
            if (res.redirectTo) window.location.assign(res.redirectTo);
            else onClose();
          }, 700);
          return;
        }
        if (res.redirectTo) {
          window.location.assign(res.redirectTo);
          return;
        }
        reset("error", res.error);
      } catch {
        reset("error", "Có lỗi khi xác minh — chạm key lại để thử lại.");
      } finally {
        busyRef.current = false;
        focusInput();
      }
    },
    [onSubmit, onClose, reset, focusInput]
  );

  const pushChars = useCallback(
    (chars: string) => {
      if (busyRef.current || !chars) return;
      const next = (bufferRef.current + chars).slice(0, YUBIKEY_OTP_LENGTH);
      bufferRef.current = next;
      setCount(next.length);
      setPhase("receiving");
      setMessage(null);

      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
      if (next.length >= YUBIKEY_OTP_LENGTH) {
        if (isValidYubikeyOtp(next)) void submit(next);
        else reset("error", "Mã nhận được không hợp lệ — chạm key lại.");
        return;
      }
      stallTimerRef.current = window.setTimeout(() => {
        reset("error", `Chỉ nhận được ${bufferRef.current.length}/${YUBIKEY_OTP_LENGTH} ký tự — chạm key lại.`);
      }, STALL_MS);
    },
    [submit, reset]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return; // cho phép Cmd+V dán mã
    const ch = modhexFromKeyCode(e.code);
    e.preventDefault();
    if (ch) pushChars(ch);
  }

  const percent = Math.round((count / YUBIKEY_OTP_LENGTH) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        // Bấm ra ngoài vẫn giữ focus để không lỡ ký tự key gõ ra.
        e.preventDefault();
        focusInput();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="yubikey-otp-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="yubikey-otp-title" className="text-xl font-bold text-slate-900">
              Vui lòng xác nhận YubiKey
            </h3>
            <p className="mt-1 text-sm text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-2xl ${
              phase === "success"
                ? "bg-emerald-100 text-emerald-600"
                : phase === "error"
                  ? "bg-rose-100 text-rose-600"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {phase === "verifying" ? (
              <Loader2 size={36} className="animate-spin" />
            ) : phase === "success" ? (
              <CheckCircle2 size={36} />
            ) : phase === "error" ? (
              <TriangleAlert size={36} />
            ) : (
              <KeyRound size={36} className={phase === "waiting" ? "animate-pulse" : ""} />
            )}
          </div>

          <p className="mt-4 font-semibold text-slate-800">
            {phase === "waiting" && "Cắm YubiKey rồi chạm vào nút trên key"}
            {phase === "receiving" && `Đang nhận ${count}/${YUBIKEY_OTP_LENGTH} ký tự từ YubiKey…`}
            {phase === "verifying" && "Đang xác minh với Yubico…"}
            {phase === "success" && message}
            {phase === "error" && "Chưa xác minh được"}
          </p>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                phase === "error" ? "bg-rose-400" : phase === "success" ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${phase === "verifying" || phase === "success" ? 100 : percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {phase === "verifying" || phase === "success"
              ? `${YUBIKEY_OTP_LENGTH}/${YUBIKEY_OTP_LENGTH} ký tự`
              : `${count}/${YUBIKEY_OTP_LENGTH} ký tự`}
          </p>

          {phase === "error" && message && (
            <p className="mt-3 w-full rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>
          )}
        </div>

        <input
          ref={inputRef}
          readOnly
          inputMode="none"
          autoComplete="off"
          aria-label="Nhận mã YubiKey"
          value=""
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = normalizeOtpInput(e.clipboardData.getData("text"));
            if (pasted) {
              bufferRef.current = "";
              pushChars(pasted);
            }
          }}
          onBlur={() => window.setTimeout(focusInput, 0)}
          className="absolute h-px w-px opacity-0"
        />

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 hover:bg-slate-50"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
