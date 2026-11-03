import { prisma } from "@/lib/prisma";
import { HistoryAction } from "@prisma/client";
import { getCurrentUser } from "@/modules/auth/auth.service";

// Lưu ý: tất cả luồng chuyển kho/bàn giao hiện tại (assets/[id]/actions.ts,
// employees/[id]/actions.ts, assets/import/actions.ts) đang gọi thẳng
// prisma.assetHistory.create() thay vì qua hàm này, nên đã tự truyền đủ
// fromWarehouseId/toWarehouseId. Hàm dùng chung này trước đây thiếu 2 field
// đó — bổ sung cho đầy đủ/đúng schema, phòng khi có chỗ khác bắt đầu dùng
// lại hàm này thay vì gọi prisma trực tiếp.
export async function createAssetHistory({
  assetId,
  action,
  fromEmployeeId,
  toEmployeeId,
  fromWarehouseId,
  toWarehouseId,
  note,
  createdBy,
}: {
  assetId: number;
  action: HistoryAction;
  fromEmployeeId?: number | null;
  toEmployeeId?: number | null;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
  note?: string | null;
  createdBy?: string;
}) {
  const author = createdBy ?? (await getCurrentUser())?.fullName ?? "System";

  return prisma.assetHistory.create({
    data: {
      assetId,
      action,
      fromEmployeeId,
      toEmployeeId,
      fromWarehouseId,
      toWarehouseId,
      note,
      createdBy: author,
    },
  });
}

export async function getAssetHistories(
  page: number = 1,
  warehouseIds?: number[] | null,
  assetId?: number | null
) {
  const pageSize = 30;
  const skip = (page - 1) * pageSize;

  // Tài khoản bị gán Region chỉ được xem lịch sử thay đổi của thiết bị thuộc
  // 1 trong các kho của Region đó. assetId dùng khi bấm "Xem tất cả" từ
  // trang chi tiết 1 thiết bị cụ thể — lọc chỉ còn lịch sử của đúng thiết bị
  // đó.
  const where = {
    ...(warehouseIds ? { asset: { warehouseId: { in: warehouseIds } } } : {}),
    ...(assetId ? { assetId } : {}),
  };

  const [histories, total] = await Promise.all([
    prisma.assetHistory.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { asset: true },
    }),
    prisma.assetHistory.count({ where }),
  ]);

  return {
    histories,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
  };
}