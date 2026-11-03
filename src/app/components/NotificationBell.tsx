import { requireLogin } from "@/modules/auth/auth.service";
import {
  getTopbarNotifications,
  getUnreadNotificationCount,
} from "@/modules/notification/notification.service";
import NotificationBellClient from "./NotificationBellClient";

// Server wrapper tự lấy dữ liệu thông báo — cho phép nhúng chuông thông báo
// ở bất kỳ trang nào (topbar mặc định, hoặc trong banner Dashboard) mà
// không cần truyền dữ liệu qua nhiều lớp props.
export default async function NotificationBell() {
  const user = await requireLogin();
  const notifications = await getTopbarNotifications(user.regionWarehouseIds);
  const unreadCount = await getUnreadNotificationCount(
    user.regionWarehouseIds,
    user.lastNotificationReadAt
  );

  return (
    <NotificationBellClient notifications={notifications} unreadCount={unreadCount} />
  );
}
