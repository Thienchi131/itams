"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// Chia secret thành từng nhóm 4 ký tự cho dễ đọc/gõ tay — chỉ hiển thị,
// không đổi giá trị thật gửi lên server.
function formatSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export default function SetupTwoFactorForm({
  otpauthUri,
  secret,
  confirmAction,
}: {
  otpauthUri: string;
  secret: string;
  confirmAction: (formData: FormData) => Promise<void>;
}) {
  const [showManualKey, setShowManualKey] = useState(false);

  return (
    <div className="mt-6">
      <ol className="space-y-2 text-sm text-slate-600">
        <li>
          1. Mở app <span className="font-semibold">Google Authenticator</span>{" "}
          (hoặc Authy, 1Password...) trên điện thoại.
        </li>
        <li>2. Quét mã QR bên dưới để thêm tài khoản ITAMS.</li>
        <li>3. Nhập mã 6 số hiện trên app vào ô bên dưới để xác nhận.</li>
      </ol>

      <div className="mt-5 flex justify-center rounded-xl border bg-slate-50 p-6">
        <QRCodeSVG value={otpauthUri} size={200} />
      </div>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setShowManualKey((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showManualKey ? "Ẩn mã nhập tay" : "Không quét được? Nhập mã tay"}
        </button>

        {showManualKey && (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 font-mono text-sm tracking-wider text-slate-700">
            {formatSecret(secret)}
          </p>
        )}
      </div>

      <form action={confirmAction} className="mt-6">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="Nhập mã 6 số"
          className="w-full rounded-lg border px-4 py-3 text-center text-lg tracking-[0.5em]"
        />

        <button className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-white">
          Xác nhận và bật 2FA
        </button>
      </form>
    </div>
  );
}
