"use client";

import { useState, useTransition } from "react";
import { verifyTwoFactorAction } from "./actions";

// Trước đây phải gõ đủ 6 số RỒI bấm "Xác nhận" mới xác thực — đổi sang tự
// động submit ngay khi đủ 6 số, đỡ 1 thao tác thừa (đằng nào cũng chỉ có 6
// số, gõ xong là biết ngay có đủ chưa, không cần xác nhận lại). Input phải
// chuyển sang controlled (value={code}) để biết chính xác lúc nào đủ 6 số —
// đồng thời gọi thẳng verifyTwoFactorAction() qua useTransition() thay vì
// dựa vào <form action={fn}> + requestSubmit() để không lệ thuộc thời điểm
// React commit giá trị input mới vào DOM (đặc biệt khi dán mã có khoảng
// trắng/ký tự lạ từ app authenticator, sau khi lọc số có thể khác giá trị
// gốc trong DOM lúc gọi requestSubmit()).
//
// isPending từ useTransition() dùng làm cờ "đang xác thực" — hiện dòng
// thông báo + khoá input/nút để user biết hệ thống đã nhận mã và đang xử lý
// (verifyTwoFactorAction gọi DB kiểm tra rate-limit + verify TOTP, không phải
// tức thời tuyệt đối). Nếu mã sai, action redirect về chính trang này kèm
// ?error=... — Server Component re-render, component này mount lại mới hoàn
// toàn, isPending tự về false, không cần tự dọn state thủ công.
export default function VerifyTwoFactorForm({ autoFocus = true }: { autoFocus?: boolean }) {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitCode(value: string) {
    const formData = new FormData();
    formData.set("code", value);
    startTransition(() => {
      verifyTwoFactorAction(formData);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isPending) submitCode(code);
      }}
      className="mt-6"
    >
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus={autoFocus}
        disabled={isPending}
        value={code}
        onChange={(e) => {
          // Chỉ giữ lại chữ số — phòng trường hợp dán cả cụm có khoảng
          // trắng (VD 1 số app authenticator hiển thị mã dạng "123 456").
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(digits);

          if (digits.length === 6) {
            submitCode(digits);
          }
        }}
        placeholder="Nhập mã 6 số"
        className="w-full rounded-lg border px-4 py-3 text-center text-lg tracking-[0.5em] outline-none disabled:bg-slate-50 disabled:text-slate-400"
      />

      {isPending && (
        <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-blue-600">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Đang xác thực...
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || code.length !== 6}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Đang xác thực..." : "Xác nhận"}
      </button>
    </form>
  );
}
