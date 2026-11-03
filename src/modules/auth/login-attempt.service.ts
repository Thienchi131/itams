import { prisma } from "@/lib/prisma";

// Ghi nhật ký MỌI lần thử đăng nhập — gọi từ login/actions.ts (nơi duy nhất
// có sẵn IP thật + kết quả rate-limit trước khi gọi tới auth.service.login()).
// Cố tình không throw nếu insert lỗi — ghi log không được phép làm sập luồng
// đăng nhập thật của user.
export async function recordLoginAttempt({
  username,
  ip,
  success,
  reason,
}: {
  username: string;
  ip: string;
  success: boolean;
  reason?: "invalid_credentials" | "rate_limited";
}) {
  try {
    await prisma.loginAttempt.create({
      data: { username, ip, success, reason: reason ?? null },
    });
  } catch (error) {
    console.error("LOGIN_ATTEMPT_LOG_ERROR:", error);
  }
}

export async function getLoginAttempts(
  page: number = 1,
  filters?: { username?: string; onlyFailed?: boolean }
) {
  const pageSize = 30;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(filters?.username
      ? { username: { contains: filters.username, mode: "insensitive" as const } }
      : {}),
    ...(filters?.onlyFailed ? { success: false } : {}),
  };

  const [attempts, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.loginAttempt.count({ where }),
  ]);

  return {
    attempts,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
  };
}
