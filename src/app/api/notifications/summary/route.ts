import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/auth.service";
import {
  getTopbarNotifications,
  getUnreadNotificationCount,
} from "@/modules/notification/notification.service";

// Route Handler riêng cho chuông thông báo — gọi bằng fetch() THẬT từ trình
// duyệt (NotificationBellClient) thay vì chỉ dựa vào props được server
// render sẵn trong RSC payload của từng trang. Lý do: Next.js prefetch sẵn
// RSC payload của các link (VD: sidebar) NGAY khi trang vừa mở, trước khi
// user bấm "đã đọc" — payload đó giữ nguyên số unread CŨ. router.refresh()
// chỉ làm mới đúng route hiện tại, không xoá các bản prefetch khác, nên
// badge vẫn hiện lại sai mỗi khi chuyển sang trang đã được prefetch từ
// trước. fetch() thường tới route này luôn là request mới, không đi qua cơ
// chế Router Cache/prefetch của Next — đảm bảo luôn đúng số liệu mới nhất.
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { notifications: [], unreadCount: 0 },
      { status: 401 }
    );
  }

  const [notifications, unreadCount] = await Promise.all([
    getTopbarNotifications(user.regionWarehouseIds),
    getUnreadNotificationCount(user.regionWarehouseIds, user.lastNotificationReadAt),
  ]);

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}
