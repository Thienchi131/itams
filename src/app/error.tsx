"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw, Home } from "lucide-react";

// Lưới an toàn cuối cùng cho TOÀN BỘ app — trước đây không hề có error.tsx
// nào (kiểm tra: không có file error.tsx/global-error.tsx ở bất kỳ đâu
// trong src/app). Next.js chỉ tự trả về thông báo lỗi mặc định KHÔNG có
// giao diện, không tiếng Việt khi 1 Server Action throw Error mà chưa được
// validate ở client trước (VD: race condition, hoặc submit form trực tiếp
// bỏ qua UI). File này bắt MỌI lỗi như vậy ở bất kỳ trang nào, hiển thị
// đúng message tiếng Việt đã viết sẵn trong action (Next.js CÓ chuyển
// nguyên message của lỗi throw từ Server Action về client, khác với lỗi
// render thường bị ẩn message vì lý do bảo mật).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <TriangleAlert size={28} />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Đã có lỗi xảy ra</h1>
      <p className="max-w-md text-sm text-slate-500">
        {error.message || "Có lỗi không xác định. Vui lòng thử lại, nếu vẫn còn liên hệ Admin."}
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <RotateCcw size={16} />
          Thử lại
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <Home size={16} />
          Về trang chính
        </a>
      </div>
    </div>
  );
}
