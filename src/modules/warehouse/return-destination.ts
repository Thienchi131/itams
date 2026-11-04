import { prisma } from "@/lib/prisma";

// Chọn kho nhập về khi THU HỒI thiết bị (từng máy hoặc hàng loạt).
//
// Trước đây kho đích tính cứng: kho chính của IT (User.warehouseId) nếu có,
// không thì giữ nguyên kho cũ của máy. Với IT phụ trách NHIỀU kho (theo Khu
// vực hoặc có kho bổ sung) thì kết quả không phản ánh đúng nơi máy thực sự
// được nhận, và IT không có cách chọn lại. Giờ form thu hồi có ô "Nhập về
// kho" (chỉ hiện khi tài khoản có từ 2 kho trở lên); server kiểm tra lại kho
// được chọn nằm trong phạm vi.

export type WarehouseOption = { id: number; code: string; name: string };

type ScopedUser = {
  regionWarehouseIds: number[] | null;
  warehouse: { id: number; name: string } | null;
};

/** Danh sách kho người dùng được phép nhập máy thu hồi về. */
export async function getReturnWarehouseOptions(
  user: Pick<ScopedUser, "regionWarehouseIds">
): Promise<WarehouseOption[]> {
  return prisma.warehouse.findMany({
    where: user.regionWarehouseIds ? { id: { in: user.regionWarehouseIds } } : undefined,
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}

/**
 * Kho mặc định đề xuất trong ô chọn: kho chính của IT nếu có, không thì kho
 * hiện tại của máy (nếu nằm trong phạm vi), không thì để trống bắt chọn.
 */
export function defaultReturnWarehouseId(
  options: WarehouseOption[],
  userWarehouseId: number | null,
  assetWarehouseId: number | null
): number | null {
  const ids = new Set(options.map((o) => o.id));
  if (userWarehouseId && ids.has(userWarehouseId)) return userWarehouseId;
  if (assetWarehouseId && ids.has(assetWarehouseId)) return assetWarehouseId;
  return null;
}

/**
 * Xác định kho đích từ giá trị form gửi lên ("returnWarehouseId").
 * - Có chọn: phải là kho tồn tại và trong phạm vi của người thao tác.
 * - Không chọn: giữ hành vi cũ (kho chính của IT, không thì kho cũ của máy)
 *   — trừ khi tài khoản có nhiều kho, lúc đó bắt buộc chọn.
 */
export async function resolveReturnWarehouse(
  user: ScopedUser,
  raw: FormDataEntryValue | null,
  assetWarehouseId: number | null
): Promise<{ id: number | null; name: string | null } | { error: string }> {
  const requested = typeof raw === "string" && raw.trim() ? Number(raw) : null;

  if (requested !== null) {
    if (!Number.isInteger(requested) || requested <= 0) {
      return { error: "Kho nhập về không hợp lệ." };
    }

    if (user.regionWarehouseIds && !user.regionWarehouseIds.includes(requested)) {
      return { error: "Kho nhập về nằm ngoài phạm vi kho bạn được phân quyền." };
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: requested },
      select: { id: true, name: true },
    });

    if (!warehouse) {
      return { error: "Kho nhập về không tồn tại." };
    }

    return warehouse;
  }

  if (!user.warehouse && user.regionWarehouseIds && user.regionWarehouseIds.length > 1) {
    return { error: "Bạn phụ trách nhiều kho — vui lòng chọn kho nhập về." };
  }

  if (user.warehouse) return { id: user.warehouse.id, name: user.warehouse.name };

  return { id: assetWarehouseId, name: null };
}
