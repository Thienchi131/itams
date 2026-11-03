import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths reachable without being logged in. Quên mật khẩu / đặt lại mật khẩu
// PHẢI công khai — đúng đối tượng dùng 2 trang này là người KHÔNG đăng nhập
// được (quên mật khẩu), nếu để middleware chặn thì bấm vào link chỉ tự động
// bị đá ngay về lại /login mà không có thông báo gì, trông như nút chết.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    // Ảnh tĩnh trong public/ (logo, mascot...) phải tải được kể cả khi CHƯA
    // đăng nhập — VD trang /login hiển thị hình con gà, nếu chặn thì trình
    // duyệt sẽ bị redirect về /login và nhận nhầm HTML thay vì ảnh (hiện icon
    // ảnh vỡ).
    /\.(png|jpe?g|gif|svg|ico|webp|avif)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSessionCookie = Boolean(request.cookies.get("userId")?.value);

  // Coarse gate: block anyone with no session cookie at all before they ever
  // reach a page. This doesn't replace requireLogin()/requireRole() (which
  // also verify the cookie's signature and check roles) — it's a safety net
  // for pages that forget to call them.
  if (!isPublicPath && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: ["/:path*"],
};