import Link from "next/link";
import { SearchX, Home } from "lucide-react";

// Trước đây không có file này — mọi URL sai (gõ nhầm, link chết, hoặc
// notFound() gọi từ 11 trang chi tiết [id] khi thiếu quyền/không tồn tại)
// đều rơi vào trang 404 MẶC ĐỊNH của Next.js: chữ tiếng Anh, không có style,
// không có lối quay lại rõ ràng. File này thay bằng giao diện tiếng Việt
// khớp phong cách chung của app.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
        <SearchX size={28} />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Không tìm thấy trang này</h1>
      <p className="max-w-md text-sm text-slate-500">
        Trang bạn tìm không tồn tại, đã bị xoá, hoặc bạn không có quyền xem. Kiểm tra lại
        đường dẫn hoặc quay về trang chính.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Home size={16} />
        Về trang chính
      </Link>
    </div>
  );
}
