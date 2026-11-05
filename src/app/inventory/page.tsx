import AppLayout from "../components/AppLayout";
import Link from "next/link";
import { AssetStatus } from "@prisma/client";
import { ClipboardCheck, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import {
  getAuditableWarehouses,
  getEligibleInventoryUsersByWarehouse,
  getInventoryAudits,
} from "@/modules/inventory/inventory.service";
import { ROLE_IT } from "@/modules/auth/permissions";
import {
  INVENTORY_SCOPE_LABEL,
  INVENTORY_STATUS_LABEL,
} from "@/modules/inventory/inventory.helpers";
import LocalDateTime from "../components/LocalDateTime";
import CreateAuditForm from "./CreateAuditForm";

// Kiểm kê kho: chọn kho + hạng mục (Trong kho / Chờ thanh lý) để tạo đợt,
// hệ thống xuất sẵn danh sách thiết bị, IT tìm đúng máy ngoài thực tế và
// chụp ảnh trực tiếp (S/N + máy) để xác nhận còn hiện hữu.
export default async function InventoryPage() {
  const currentUser = await requireRole(["Admin", "IT"]);
  const scope = currentUser.regionWarehouseIds;

  const [warehouses, audits] = await Promise.all([
    getAuditableWarehouses(scope),
    getInventoryAudits(currentUser),
  ]);
  const eligibleByWarehouse = await getEligibleInventoryUsersByWarehouse(
    warehouses.map((w) => w.id)
  );

  // Số thiết bị hiện có theo từng hạng mục ở mỗi kho — để form báo trước
  // danh sách kiểm kê sẽ gồm bao nhiêu máy.
  const warehouseIds = warehouses.map((w) => w.id);
  const [inStockCounts, pendingLiquidationCounts] = await Promise.all([
    prisma.asset.groupBy({
      by: ["warehouseId"],
      where: { warehouseId: { in: warehouseIds }, status: AssetStatus.IN_STOCK },
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["warehouseId"],
      where: {
        warehouseId: { in: warehouseIds },
        status: AssetStatus.RETIRED,
        liquidatedAt: null,
      },
      _count: { _all: true },
    }),
  ]);
  const inStockMap = new Map(inStockCounts.map((row) => [row.warehouseId, row._count._all]));
  const pendingMap = new Map(
    pendingLiquidationCounts.map((row) => [row.warehouseId, row._count._all])
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Kiểm kê kho</h2>
        <p className="mt-1 text-sm text-slate-500">
          Chọn kho và hạng mục để tạo đợt kiểm kê. Mỗi thiết bị được xác nhận bằng ảnh chụp
          trực tiếp (tem S/N + thiết bị) — không chọn ảnh có sẵn được.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <ClipboardCheck size={20} className="text-blue-600" />
          Tạo đợt kiểm kê mới
        </h3>
        <CreateAuditForm
          currentUserId={currentUser.id}
          creatorIsIt={currentUser.role.name === ROLE_IT}
          warehouses={warehouses.map((w) => ({
            id: w.id,
            label: `${w.code} - ${w.name}`,
            inStock: inStockMap.get(w.id) ?? 0,
            pendingLiquidation: pendingMap.get(w.id) ?? 0,
            itUsers: eligibleByWarehouse.get(w.id) ?? [],
          }))}
        />
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Đợt</th>
              <th className="p-4 text-left">Kho</th>
              <th className="p-4 text-left">Hạng mục</th>
              <th className="p-4 text-left">IT tham gia</th>
              <th className="p-4 text-left">Tiến độ</th>
              <th className="p-4 text-left">Trạng thái</th>
              <th className="p-4 text-left">Tạo</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit) => {
              const missing = audit.totalCount - audit.confirmedCount;
              return (
                <tr key={audit.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                  <td className="p-4 font-bold text-slate-900">#{audit.id}</td>
                  <td className="p-4">{audit.warehouseLabel}</td>
                  <td className="p-4 text-slate-600">{INVENTORY_SCOPE_LABEL[audit.scope]}</td>
                  <td className="p-4 text-slate-600">
                    {audit.participants.map((p) => p.user.fullName).join(", ") || "-"}
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-slate-800">
                      {audit.confirmedCount}/{audit.totalCount}
                    </span>
                    {audit.status === "COMPLETED" && missing > 0 && (
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                        Thiếu {missing}
                      </span>
                    )}
                    {audit.status === "COMPLETED" && missing === 0 && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        Đủ
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        audit.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-700"
                          : audit.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {INVENTORY_STATUS_LABEL[audit.status]}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">
                    <LocalDateTime value={audit.createdAt} mode="date" />
                    <p className="text-xs text-slate-400">{audit.createdBy ?? "-"}</p>
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/inventory/${audit.id}`}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={16} />
                      {audit.status === "IN_PROGRESS" ? "Tiếp tục" : "Xem báo cáo"}
                    </Link>
                  </td>
                </tr>
              );
            })}

            {audits.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-sm text-slate-500">
                  Chưa có đợt kiểm kê nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
