"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";

/**
 * Đánh dấu đã đọc toàn bộ thông báo tính tới thời điểm hiện tại — gọi khi
 * user bấm mở panel chuông thông báo. Lần load trang sau đó, badge số sẽ
 * chỉ đếm thông báo phát sinh SAU mốc thời gian này.
 */
export async function markNotificationsReadAction() {
  const user = await requireLogin();

  await prisma.user.update({
    where: { id: user.id },
    data: { lastNotificationReadAt: new Date() },
  });
}
