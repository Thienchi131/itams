import AppLayout from "../components/AppLayout";
import { getSupplies, isLowStock } from "@/modules/supply/supply.service";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData, ROLE_ADMIN } from "@/modules/auth/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import WarehouseFilterSelect from "../components/WarehouseFilterSelect";
import { scopedWarehouseCount } from "@/lib/warehouse-filter";
import DeleteSupplyModal from "./DeleteSupplyModal";
import { Package, Plus, Search, TriangleAlert, CheckCircle2 } from "lucide-react";

const SUCCESS_MESSAGES: Record<string, string> = {
  supply_deleted: "Đã xoá vật tư.",
};

export default async function SuppliesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    warehouseId?: string;
    regionId?: string;
    success?: string;
  }>;
}) {
  const currentUser = await requireLogin();
  const canEdit = canEditData(currentUser.role.name);
  const isAdmin = currentUser.role.name === ROLE_ADMIN;

  const {
    q,
    warehouseId: warehouseIdParam,
    regionId: regionIdParam,
    success,
  } = await searchParams;

  const regionWarehouseIds = currentUser.regionWarehouseIds;

  // Dropdown lọc theo kho phân cấp Khu vực > Kho — giống Dashboard/Tài sản,
  // cho phép xem gộp cả 1 khu vực (nhiều kho) hoặc drill xuống đúng 1 kho.
  // Chỉ lấy khu vực còn ít nhất 1 kho — khu vực rỗng hiện ra chỉ gây rối mắt.
  const allRegions = await prisma.region.findMany({
    where: regionWarehouseIds
      ? { warehouses: { some: { id: { in: regionWarehouseIds } } } }
      : { warehouses: { some: {} } },
    include: {
      // Lọc luôn kho TRONG mỗi khu vực theo đúng phạm vi được phép — tránh
      // rò rỉ các kho khác cùng khu vực cho tài khoản chỉ được gán 1 kho lẻ
      // (warehouseId, không phải cả Region).
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

  // warehouseIds thực tế đưa vào query: ưu tiên lựa chọn tay trên dropdown,
  // rơi về phạm vi Region của tài khoản nếu chưa chọn gì (Admin = null = xem
  // toàn bộ, giống hành vi trước đây).
  const effectiveWarehouseIds = selectedWarehouseId
    ? [selectedWarehouseId]
    : selectedRegion
      ? selectedRegion.warehouses.map((w) => w.id)
      : regionWarehouseIds;

  const supplies = await getSupplies(q, effectiveWarehouseIds);
  const lowStockCount = supplies.filter(isLowStock).length;

  return (
    <AppLayout>
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Vật tư</h2>
          <p className="mt-1 text-slate-500">
            Hàng tiêu hao tính theo số lượng (cáp sạc, adapter, chuột, bàn phím...)
            {lowStockCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-600">
                <TriangleAlert size={14} />
                {lowStockCount} vật tư sắp hết
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(!regionWarehouseIds || scopedWarehouseCount(allRegions, unassignedWarehouses) > 1) && (
            <WarehouseFilterSelect
              regions={allRegions}
              unassignedWarehouses={unassignedWarehouses}
              selectedWarehouseId={selectedWarehouseId}
              selectedRegionId={selectedRegion?.id ?? null}
            />
          )}

          {canEdit && (
            <Link
              href="/supplies/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md"
            >
              <Plus size={18} />
              Thêm vật tư
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form className="border-b border-slate-100 p-5">
          {/* Giữ nguyên bộ lọc kho/khu vực đang chọn khi tìm kiếm — form GET
              chỉ gửi field bên trong nó, không tự giữ query string cũ. */}
          {selectedWarehouseId && (
            <input type="hidden" name="warehouseId" value={selectedWarehouseId} />
          )}
          {selectedRegion && (
            <input type="hidden" name="regionId" value={selectedRegion.id} />
          )}

          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Tìm theo mã hoặc tên vật tư..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Mã</th>
              <th className="p-4 text-left">Tên vật tư</th>
              <th className="p-4 text-left">Kho</th>
              <th className="p-4 text-left">Đơn vị</th>
              <th className="p-4 text-center">Tồn kho</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {supplies.map((supply) => {
              const low = isLowStock(supply);

              return (
                <tr
                  key={supply.id}
                  className="border-t border-slate-100 transition hover:bg-blue-50/40"
                >
                  <td className="p-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                      {supply.code}
                    </span>
                  </td>

                  <td className="p-4 font-semibold text-slate-800">
                    {supply.name}
                  </td>

                  <td className="p-4">
                    {supply.warehouse ? (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {supply.warehouse.code} - {supply.warehouse.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="p-4 text-slate-600">{supply.unit}</td>

                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-full px-3 py-1 font-bold ${
                        low
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {low && <TriangleAlert size={13} />}
                      {supply.quantity} {supply.unit}
                    </span>
                    {supply.minQuantity > 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        Ngưỡng: {supply.minQuantity}
                      </p>
                    )}
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/supplies/${supply.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Xem
                      </Link>

                      {isAdmin && (
                        <DeleteSupplyModal
                          supplyId={supply.id}
                          quantity={supply.quantity}
                          unit={supply.unit}
                          label={`${supply.code} - ${supply.name}`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {supplies.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Package size={28} />
                    </div>

                    <p className="font-bold text-slate-700">
                      Chưa có vật tư nào
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Bấm &quot;Thêm vật tư&quot; để tạo mục đầu tiên.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
