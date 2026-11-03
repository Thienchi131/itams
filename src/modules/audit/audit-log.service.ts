import { prisma } from "@/lib/prisma";

// Audit trail cho các thao tác NHẠY CẢM ngoài phạm vi tài sản — quản lý tài
// khoản (tạo/sửa/xoá/reset mật khẩu/reset 2FA), whitelist IP, bật/tắt Import
// Excel, gộp/xoá Model. Tài sản đã có AssetHistory riêng (chi tiết hơn, gắn
// với từng thiết bị) nên KHÔNG log trùng ở đây. Cố tình không throw nếu
// insert lỗi — ghi log không được phép làm sập thao tác thật của Admin.
export async function createAuditLog({
  actorName,
  action,
  targetType,
  targetId,
  detail,
}: {
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string | number | null;
  detail?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorName,
        action,
        targetType: targetType ?? null,
        targetId: targetId != null ? String(targetId) : null,
        detail: detail ?? null,
      },
    });
  } catch (error) {
    console.error("AUDIT_LOG_ERROR:", error);
  }
}

export async function getAuditLogs(page: number = 1) {
  const pageSize = 30;
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count(),
  ]);

  return {
    logs,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
  };
}
