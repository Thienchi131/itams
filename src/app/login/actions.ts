"use server";

import { login } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isRateLimited } from "@/lib/rate-limit";
import { recordLoginAttempt } from "@/modules/auth/login-attempt.service";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

// Backstop cho trường hợp trên: app hiện chưa chạy sau reverse proxy
// (chưa có Nginx/HTTPS) nên KHÔNG có gì đảm bảo header x-forwarded-for là
// thật — 1 script có thể tự gắn header giả, đổi mỗi request để né hoàn
// toàn giới hạn theo IP ở trên. Giới hạn thêm 1 lớp tính THEO EMAIL, không
// phụ thuộc IP claim — script không thể giả mạo bỏ qua lớp này vì email bị
// tấn công luôn cố định. Ngưỡng nới hơn 1 chút để tránh khoá oan user thật
// gõ sai vài lần.
const EMAIL_MAX_ATTEMPTS = 10;
const EMAIL_WINDOW_MS = 10 * 60 * 1000;

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") || "");
  const remember = formData.get("remember") === "on";

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (
    isRateLimited(`${ip}:${email}`, MAX_ATTEMPTS, WINDOW_MS) ||
    isRateLimited(`email:${email}`, EMAIL_MAX_ATTEMPTS, EMAIL_WINDOW_MS)
  ) {
    await recordLoginAttempt({ username: email, ip, success: false, reason: "rate_limited" });
    redirect("/login?error=rate_limited");
  }

  const user = await login(email, password, remember);

  if (!user) {
    await recordLoginAttempt({ username: email, ip, success: false, reason: "invalid_credentials" });
    redirect("/login?error=1");
  }

  await recordLoginAttempt({ username: email, ip, success: true });

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  // 2FA bắt buộc với mọi tài khoản — chưa bật thì đi thiết lập, đã bật rồi
  // thì phải nhập mã TOTP mỗi lần đăng nhập lại (phiên mới luôn bắt đầu ở
  // trạng thái chưa xác thực, xem login() trong auth.service.ts).
  if (!user.twoFactorEnabled) {
    redirect("/setup-2fa");
  }

  redirect("/verify-2fa");
}