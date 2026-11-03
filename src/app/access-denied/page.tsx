import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireLogin } from "@/modules/auth/auth.service";
import { getDefaultRouteForRole } from "@/modules/auth/permissions";

// Đích chuyển hướng chung khi requireRole() phát hiện tài khoản không đủ
// quyền vào 1 trang — trước đây đá thẳng về trang mặc định của role đó
// (thường là "/") mà không có thông báo gì, trông như link chết. Trang này
// giải thích rõ lý do + đưa lối quay lại đúng trang phù hợp với role.
export default async function AccessDeniedPage() {
  const user = await requireLogin();
  const homeHref = getDefaultRouteForRole(user.role.name);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <ShieldAlert size={28} />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Bạn không có quyền truy cập trang này</h1>
      <p className="max-w-md text-sm text-slate-500">
        Tài khoản <span className="font-semibold text-slate-700">{user.fullName}</span> (role{" "}
        <span className="font-semibold text-slate-700">{user.role.name}</span>) không được cấp
        quyền vào mục này. Liên hệ Admin nếu bạn cho rằng đây là nhầm lẫn.
      </p>
      <Link
        href={homeHref}
        className="mt-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Quay lại trang chính
      </Link>
    </div>
  );
}
