"use client";

import { useState } from "react";

type Props = {
  title: string;
  text: string;
};

export default function AssetHandoverText({
  title,
  text,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  // navigator.clipboard chỉ hoạt động trên "secure context" (HTTPS hoặc
  // localhost) — trang đang chạy HTTP thường (chưa gắn SSL) nên API này
  // không tồn tại (undefined), khiến nút bấm không phản ứng gì. Fallback
  // sang cách copy kiểu cũ (textarea ẩn + execCommand) để vẫn copy được
  // trên HTTP, và luôn báo cho user biết kết quả thay vì im lặng.
  async function handleCopy() {
    try {
      // Điền giờ thật tại đúng lúc bấm copy, theo múi giờ của thiết bị
      // (trình duyệt) đang thao tác — không lấy giờ server vì user có thể
      // ở múi giờ khác VPS.
      const now = new Date().toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const finalText = text.replace("{{NOW}}", now);

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(finalText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = finalText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!ok) throw new Error("execCommand copy failed");
      }

      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("COPY_ERROR:", error);
      setCopied(false);
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl border bg-white p-6 text-left hover:bg-slate-50 transition"
    >
      <h3 className="text-lg font-semibold">{title}</h3>

      <p className="mt-2 text-sm text-slate-500">
        {copied
          ? "✅ Đã copy vào clipboard"
          : failed
            ? "❌ Không copy được, vui lòng bôi đen và copy thủ công"
            : "Bấm để copy biên bản"}
      </p>
    </button>
  );
}