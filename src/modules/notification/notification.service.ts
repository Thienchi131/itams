import { prisma } from "@/lib/prisma";
import { getHistoryActionLabel } from "@/modules/asset/asset.helpers";

const MAX_ITEMS = 10;

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  href: string;
  createdAt: Date;
};

/**
 * Recent device changes (stock-in, bàn giao, thu hồi, sửa chữa, ...) shown in
 * the topbar bell — driven by real AssetHistory rows instead of a hardcoded
 * badge count.
 */
export async function getTopbarNotifications(
  warehouseIds?: number[] | null
): Promise<AppNotification[]> {
  // Tài khoản bị gán Region chỉ được thấy thông báo thay đổi thiết bị của
  // các kho thuộc Region đó, không lộ thao tác ở các kho khác.
  const histories = await prisma.assetHistory.findMany({
    where: warehouseIds ? { asset: { warehouseId: { in: warehouseIds } } } : {},
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
    include: { asset: true },
  });

  return histories.map((history) => ({
    id: `history-${history.id}`,
    title: getHistoryActionLabel(history.action),
    description: `${history.asset.assetTag}${
      history.note ? ` — ${history.note}` : ""
    }`,
    href: `/assets/${history.asset.id}`,
    createdAt: history.createdAt,
  }));
}

/**
 * Số thông báo CHƯA đọc — đếm số AssetHistory phát sinh sau lần cuối user
 * mở panel thông báo (lastNotificationReadAt). Nếu user chưa bao giờ mở
 * panel thì đếm luôn toàn bộ (tối đa MAX_ITEMS hiển thị trong panel, nhưng
 * số đếm ở đây phản ánh đúng số lượng thật, không bị chặn ở 10).
 */
export async function getUnreadNotificationCount(
  warehouseIds: number[] | null | undefined,
  lastReadAt: Date | null | undefined
): Promise<number> {
  return prisma.assetHistory.count({
    where: {
      ...(warehouseIds ? { asset: { warehouseId: { in: warehouseIds } } } : {}),
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}
