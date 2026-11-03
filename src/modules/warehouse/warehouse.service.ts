import { prisma } from "@/lib/prisma";

// Kèm số tài sản + số vật tư đang gán vào từng kho — dùng để quyết định có
// cho xoá kho hay không (không cho xoá nếu vẫn còn asset/supply tham chiếu
// tới, tránh mồ côi dữ liệu) và để Admin thấy trước hệ quả trước khi xoá.
// Kèm luôn Region đang thuộc về (nếu có) để hiển thị + cho phép đổi trực
// tiếp trên dòng kho — Warehouse.regionId là FK thật quyết định phân quyền
// theo khu vực, chứ không phải User trỏ thẳng tới Warehouse nữa.
export async function getWarehousesWithCounts() {
  return prisma.warehouse.findMany({
    orderBy: { code: "asc" },
    include: {
      region: true,
      _count: {
        select: { assets: true, supplies: true },
      },
    },
  });
}

/**
 * Chuẩn hoá lựa chọn "xem theo Kho/Khu vực" từ query string (warehouseId
 * hoặc regionId) thành effectiveWarehouseIds thực dùng cho query — dùng
 * chung cho mọi trang có dropdown WarehouseFilterSelect (Quản lý tài sản,
 * Theo dõi sửa chữa, Kho thanh lý...) để khỏi lặp lại cùng 1 đoạn logic ở
 * từng page.tsx, dễ phát sinh lệch nhau qua thời gian.
 *
 * regionWarehouseIds = phạm vi TỐI ĐA tài khoản được phép xem (null nghĩa là
 * không giới hạn, VD Admin). Lựa chọn tay trên dropdown (warehouseId/
 * regionId param) chỉ được phép THU HẸP xuống trong phạm vi đó, không được
 * mở rộng ra ngoài — validate lại ở đây, không tin thẳng param từ URL.
 */
export async function resolveWarehouseFilter(
  regionWarehouseIds: number[] | null,
  warehouseIdParam?: string,
  regionIdParam?: string
) {
  const allRegions = await prisma.region.findMany({
    where: regionWarehouseIds
      ? { warehouses: { some: { id: { in: regionWarehouseIds } } } }
      : { warehouses: { some: {} } },
    include: {
      warehouses: {
        where: regionWarehouseIds ? { id: { in: regionWarehouseIds } } : undefined,
        orderBy: { code: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const unassignedWarehouses = regionWarehouseIds
    ? []
    : await prisma.warehouse.findMany({
        where: { regionId: null },
        orderBy: { code: "asc" },
      });

  const requestedWarehouseId = warehouseIdParam ? Number(warehouseIdParam) : null;
  const selectedWarehouseId =
    requestedWarehouseId &&
    (!regionWarehouseIds || regionWarehouseIds.includes(requestedWarehouseId))
      ? requestedWarehouseId
      : null;

  const requestedRegionId = regionIdParam ? Number(regionIdParam) : null;
  const selectedRegion =
    !selectedWarehouseId && requestedRegionId
      ? allRegions.find((region) => region.id === requestedRegionId) ?? null
      : null;

  const effectiveWarehouseIds = selectedWarehouseId
    ? [selectedWarehouseId]
    : selectedRegion
      ? selectedRegion.warehouses.map((w) => w.id)
      : regionWarehouseIds;

  return {
    allRegions,
    unassignedWarehouses,
    selectedWarehouseId,
    selectedRegion,
    effectiveWarehouseIds,
  };
}
