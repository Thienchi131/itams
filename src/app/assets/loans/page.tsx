import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireLogin } from "@/modules/auth/auth.service";
import { getAssetsWithAssignmentDue } from "@/modules/asset/asset.service";
import { resolveWarehouseFilter } from "@/modules/warehouse/warehouse.service";
import { ASSIGNMENT_TYPE_LABEL } from "@/modules/asset/asset.helpers";
import WarehouseFilterSelect from "../../components/WarehouseFilterSelect";
import LocalDateTime from "../../components/LocalDateTime";
import { ArrowLeft, CalendarClock, Eye, TriangleAlert } from "lucide-react";

// Ngưỡng để coi 1 thiết bị Cấp mượn/Cấp tạm chờ bảo hành là "sắp đến hạn"
// (chưa quá hạn nhưng còn ít ngày, cần nhắc chủ động trước khi thực sự trễ).
const SOON_DUE_DAYS_THRESHOLD = 7;

export default async function AssignmentLoansPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string; regionId?: string }>;
}) {
  const currentUser = await requireLogin();
  const { warehouseId: warehouseIdParam, regionId: regionIdParam } =
    await searchParams;

  const regionWarehouseIds = currentUser.regionWarehouseIds;

  const {
    allRegions,
    unassignedWarehouses,
    selectedWarehouseId,
    selectedRegion,
    effectiveWarehouseIds,
  } = await resolveWarehouseFilter(
    regionWarehouseIds,
    warehouseIdParam,
    regionIdParam
  );

  const assets = await getAssetsWithAssignmentDue(effectiveWarehouseIds);
  const overdueCount = assets.filter((a) => a.daysRemaining < 0).length;
  const soonDueCount = assets.filter(
    (a) => a.daysRemaining >= 0 && a.daysRemaining <= SOON_DUE_DAYS_THRESHOLD
  ).length;

  return (
    <AppLayout>
      <Link
        href="/assets"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Tài sản
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Cấp mượn / Chờ bảo hành
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách thiết bị đang bàn giao dưới dạng Cấp mượn hoặc Cấp tạm
            chờ bảo hành — có hạn cần thu hồi lại, khác với Cấp nhân viên mới
            (không có hạn).
          </p>
        </div>

        {(!regionWarehouseIds ||
          allRegions.some((r) => r.warehouses.length > 1)) && (
          <WarehouseFilterSelect
            regions={allRegions}
            unassignedWarehouses={unassignedWarehouses}
            selectedWarehouseId={selectedWarehouseId}
            selectedRegionId={selectedRegion?.id ?? null}
          />
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarClock size={20} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{assets.length}</div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Thiết bị Cấp mượn/Chờ bảo hành
          </p>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            soonDueCount > 0
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div
            className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${
              soonDueCount > 0
                ? "bg-amber-100 text-amber-600"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            <TriangleAlert size={20} />
          </div>
          <div
            className={`text-2xl font-extrabold ${
              soonDueCount > 0 ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {soonDueCount}
          </div>
          <p
            className={`mt-1 text-sm font-semibold ${
              soonDueCount > 0 ? "text-amber-600" : "text-slate-500"
            }`}
          >
            Sắp đến hạn (≤ {SOON_DUE_DAYS_THRESHOLD} ngày)
          </p>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            overdueCount > 0
              ? "border-rose-200 bg-rose-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div
            className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${
              overdueCount > 0
                ? "bg-rose-100 text-rose-600"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            <TriangleAlert size={20} />
          </div>
          <div
            className={`text-2xl font-extrabold ${
              overdueCount > 0 ? "text-rose-700" : "text-slate-900"
            }`}
          >
            {overdueCount}
          </div>
          <p
            className={`mt-1 text-sm font-semibold ${
              overdueCount > 0 ? "text-rose-600" : "text-slate-500"
            }`}
          >
            Đã quá hạn thu hồi
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Asset Tag</th>
              <th className="p-4 text-left">Model</th>
              <th className="p-4 text-left">Serial</th>
              <th className="p-4 text-left">Kho</th>
              <th className="p-4 text-left">Người giữ</th>
              <th className="p-4 text-left">Loại cấp phát</th>
              <th className="p-4 text-left">Hạn trả</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="border-t border-slate-100 transition hover:bg-blue-50/40"
              >
                <td className="p-4 font-bold text-slate-900">{asset.assetTag}</td>

                <td className="p-4">
                  {asset.model.brand} {asset.model.modelName}
                </td>

                <td className="p-4 text-slate-600">{asset.serialNumber}</td>

                <td className="p-4">
                  <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {asset.warehouse
                      ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                      : "-"}
                  </span>
                </td>

                <td className="p-4 text-slate-600">
                  {asset.currentEmployee?.fullName ?? "-"}
                </td>

                <td className="p-4 text-slate-600">
                  {asset.assignmentType
                    ? ASSIGNMENT_TYPE_LABEL[asset.assignmentType]
                    : "-"}
                </td>

                <td className="p-4">
                  {asset.assignmentDueAt ? (
                    <LocalDateTime value={asset.assignmentDueAt} mode="date" />
                  ) : (
                    "-"
                  )}

                  <span
                    className={`mt-1 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      asset.daysRemaining < 0
                        ? "bg-rose-100 text-rose-700"
                        : asset.daysRemaining <= SOON_DUE_DAYS_THRESHOLD
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    <TriangleAlert size={11} />
                    {asset.daysRemaining < 0
                      ? `Quá hạn ${Math.abs(asset.daysRemaining)} ngày`
                      : `Còn ${asset.daysRemaining} ngày`}
                  </span>
                </td>

                <td className="p-4 text-right">
                  <Link
                    href={`/assets/${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Eye size={16} />
                    Xem
                  </Link>
                </td>
              </tr>
            ))}

            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <CalendarClock size={28} />
                    </div>
                    <p className="font-bold text-slate-700">
                      Không có thiết bị nào đang Cấp mượn/Chờ bảo hành
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
