"use server";

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
} from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/mail";
import { isRateLimited } from "@/lib/rate-limit";

const IP_MAX_ATTEMPTS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 3;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;

async function getBaseUrl() {
  // Cho phép ép cứng qua APP_URL (VD: khi chạy sau reverse proxy không
  // truyền đúng header host/proto) — mặc định tự suy ra từ chính request.
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  return `${proto}://${host}`;
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // QUAN TRỌNG: luôn redirect về CÙNG 1 trang "đã gửi" bất kể email có tồn
  // tại trong hệ thống hay không, và bất kể có bị rate-limit hay không —
  // nếu phản hồi khác nhau giữa 2 trường hợp, kẻ tấn công có thể dò ra
  // chính xác email nào đang có tài khoản (user enumeration).
  if (
    !email ||
    isRateLimited(`resetip:${ip}`, IP_MAX_ATTEMPTS, IP_WINDOW_MS) ||
    isRateLimited(`resetemail:${email}`, EMAIL_MAX_ATTEMPTS, EMAIL_WINDOW_MS)
  ) {
    redirect("/forgot-password?sent=1");
  }

  const user = await prisma.user.findFirst({ where: { username: email } });

  if (user) {
    // Vô hiệu hoá mọi token cũ CHƯA dùng của user này trước khi tạo token
    // mới — tránh trường hợp bấm "Quên mật khẩu" nhiều lần để lại nhiều
    // link cùng sống song song (chỉ link mới nhất còn hiệu lực).
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const baseUrl = await getBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Không await — cùng lý do như các chỗ gửi email khác trong app: SMTP
    // chậm/bị chặn không được phép treo cả trang.
    sendPasswordResetEmail({
      to: user.username,
      fullName: user.fullName,
      resetUrl,
    }).catch((error) => {
      console.error("SEND_RESET_EMAIL_ERROR:", error);
    });
  }

  redirect("/forgot-password?sent=1");
}
