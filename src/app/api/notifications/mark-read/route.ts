import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { getUnreadNotificationCount } from "@/modules/notification/notification.service";

// Trước đây thao tác "đánh dấu đã đọc" gọi qua Next.js Server Action
// (markNotificationsReadAction). Server Action có cơ chế ngầm tự re-render
// lại cây Server Component của TRANG HIỆN TẠI để gửi kèm UI mới trong cùng 1
// response — cơ chế này khó kiểm soát chặt và là nghi phạm chính gây ra hiện
// tượng badge "tắt rồi hiện lại" (state bị 1 payload ngầm đè lại). Chuyển
// sang Route Handler + fetch() thường như /api/notifications/summary để
// toàn bộ luồng ghi + đọc lại đều do CHÍNH client tự kiểm soát hoàn toàn,
// không còn phụ thuộc hành vi tự động nào của Next.js nữa.
export async function POST() {
  const user = await getCurrentUser();

  // Chưa qua 2FA / chưa đổi mật khẩu lần đầu thì coi như chưa đăng nhập —
  // giống requireLogin(), tránh đọc thông báo chỉ với mật khẩu.
  if (!user || !user.twoFactorVerified || user.mustChangePassword) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const readAt = new Date();

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastNotificationReadAt: readAt },
  });

  // Đếm lại NGAY trong cùng request này (dùng đúng giá trị vừa ghi, không
  // đọc lại qua request GET riêng) — để so sánh với số mà /summary trả về
  // ngay sau đó. Nếu 2 số này KHÁC NHAU dù cùng đọc từ 1 DB, tức là có vấn
  // đề caching/kết nối ở đâu đó chứ không phải do phía client.
  const recount = await getUnreadNotificationCount(
    user.regionWarehouseIds,
    updated.lastNotificationReadAt
  );

  return NextResponse.json(
    {
      ok: true,
      writtenLastNotificationReadAt: updated.lastNotificationReadAt,
      recountRightAfterWrite: recount,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
