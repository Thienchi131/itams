"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import YubikeyOtpModal from "./YubikeyOtpModal";
import { loginWithYubikeyAction, registerYubikeyAction } from "./yubikey-actions";

// Đăng ký YubiKey (mỗi tài khoản 1 key): thiết lập 2FA lần đầu ("setup")
// hoặc bị bắt đăng ký ("enforce") -> xong là vào hệ thống.
export function RegisterYubikeyButton({ mode }: { mode: "setup" | "enforce" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
      >
        <KeyRound size={18} />
        Đăng ký YubiKey
      </button>
      {open && (
        <YubikeyOtpModal
          title={mode === "setup" ? "Thiết lập xác thực 2 lớp bằng YubiKey" : "Đăng ký YubiKey cho tài khoản"}
          onSubmit={registerYubikeyAction}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// Bước 2FA khi đăng nhập: chạm YubiKey thay cho nhập mã app.
export function YubikeyLoginButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
      >
        <KeyRound size={18} />
        Dùng YubiKey
      </button>
      {open && (
        <YubikeyOtpModal
          title="Xác thực 2 lớp khi đăng nhập"
          onSubmit={loginWithYubikeyAction}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
