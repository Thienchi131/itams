import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth.service";
import { resolveWarehouseFilter } from "@/modules/warehouse/warehouse.service";
import { getPendingHandoverPhotosByEmployee } from "@/modules/asset/handover-photo.service";
import {
  HANDOVER_PHOTO_DUE_DAYS,
  type HandoverPhotoStatus,
} from "@/modules/asset/handover-photo.helpers";
import WarehouseFilterSelect from "../../components/WarehouseFilterSelect";
import LocalDateTime from "../../components/LocalDateTime";
import EmployeePhotoUpload from "./EmployeePhotoUpload";
import { ArrowLeft, ChevronDown, Eye, ImageIcon, TriangleAlert, UserRound } from "lucide-react";

// Nhân viên có thiết bị bàn giao còn THIẾU ảnh xác nhận (ảnh không bắt buộc
// lúc bàn giao nhưng phải bổ sung trong 7 ngày) — gom theo NHÂN VIÊN: bấm vào
// 1 nhân viên để xem các thiết bị chưa có ảnh và bổ sung 1 lần cho cả nhóm.
// Thiết bị đã có ảnh, hoặc đã thu hồi/đổi tay, tự biến mất khỏi danh sách —
// xem getPendingHandoverPhotos() trong handover-photo.service.ts.
export default async function HandoverPhotosPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string; regionId?: string }>;
}) {
  // Chỉ Admin/IT (người bổ sung được ảnh) — User (viewer) không cần danh sách này.
  const currentUser = await requireRole(["Admin", "IT"]);
  const { warehouseId: warehouseIdParam, regionId: regionIdParam } = await searchParams;

  const regionWarehouseIds = currentUser.regionWarehouseIds;

  const {
    allRegions,
    unassignedWarehouses,
    selectedWarehouseId,
    selectedRegion,
    effectiveWarehouseIds,
  } = await resolveWarehouseFilter(regionWarehouseIds, warehouseIdParam, regionIdParam);

  const groups = await getPendingHandoverPhotosByEmployee(effectiveWarehouseIds);
  const overdueEmployeeCount = groups.filter((g) => g.overdueCount > 0).length;
  const deviceCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  // Giữ filter kho khi bổ sung ảnh xong quay lại trang này.
  const query = new URLSearchParams();
  if (warehouseIdParam) query.set("warehouseId", warehouseIdParam);
  if (regionIdParam) query.set("regionId", regionIdParam);
  const selfHref = `/assets/handover-photos${query.toString() ? `?${query.toString()}` : ""}`;

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
          <h2 className="text-2xl font-bold text-slate-900">Ảnh bàn giao chờ bổ sung</h2>
          <p className="mt-1 text-sm text-slate-500">
            Nhân viên đã nhận thiết bị nhưng chưa có ảnh xác nhận bàn giao. Ảnh phải bổ sung
            trong {HANDOVER_PHOTO_DUE_DAYS} ngày kể từ ngày bàn giao — bấm vào từng nhân viên để
            xem thiết bị và bổ sung ảnh.
          </p>
        </div>

        {(!regionWarehouseIds || allRegions.some((r) => r.warehouses.length > 1)) && (
          <WarehouseFilterSelect
            regions={allRegions}
            unassignedWarehouses={unassignedWarehouses}
            selectedWarehouseId={selectedWarehouseId}
            selectedRegionId={selectedRegion?.id ?? null}
          />
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard
          icon={<UserRound size={20} />}
          value={groups.length}
          label={`Nhân viên chờ bổ sung ảnh (${deviceCount} thiết bị)`}
          tone={groups.length > 0 ? "amber" : "slate"}
        />
        <StatCard
          icon={<TriangleAlert size={20} />}
          value={overdueEmployeeCount}
          label="Nhân viên có thiết bị quá hạn"
          tone={overdueEmployeeCount > 0 ? "rose" : "slate"}
        />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <ImageIcon size={28} />
          </div>
          <p className="font-bold text-slate-700">Không có nhân viên nào đang thiếu ảnh bàn giao</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <details
              key={group.employee.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 hover:bg-blue-50/40 sm:p-5 [&::-webkit-details-marker]:hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserRound size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{group.employee.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {group.employee.employeeCode} · {group.items.length} thiết bị chưa có ảnh
                  </p>
                </div>

                <StatusBadge status={group.earliestStatus} overdueCount={group.overdueCount} />

                <ChevronDown
                  size={18}
                  className="shrink-0 text-slate-400 transition group-open:rotate-180"
                />
              </summary>

              <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-2 text-left">Asset Tag</th>
                        <th className="pb-2 text-left">Model</th>
                        <th className="pb-2 text-left">Kho</th>
                        <th className="pb-2 text-left">Bàn giao</th>
                        <th className="pb-2 text-left">Hạn bổ sung ảnh</th>
                        <th className="pb-2 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.historyId} className="border-t border-slate-100">
                          <td className="py-3 font-bold text-slate-900">{item.asset.assetTag}</td>
                          <td className="py-3">
                            {item.asset.model.brand} {item.asset.model.modelName}
                          </td>
                          <td className="py-3 text-slate-600">
                            {item.asset.warehouse
                              ? `${item.asset.warehouse.code} - ${item.asset.warehouse.name}`
                              : "-"}
                          </td>
                          <td className="py-3 text-slate-600">
                            <LocalDateTime value={item.handedOverAt} mode="date" />
                            <p className="text-xs text-slate-400">bởi {item.createdBy ?? "-"}</p>
                          </td>
                          <td className="py-3">
                            <LocalDateTime value={item.photoDueAt} mode="date" />
                            <div className="mt-1">
                              <StatusBadge status={item.status} />
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              href={`/assets/${item.asset.id}?returnTo=${encodeURIComponent(
                                selfHref
                              )}#handover-${item.historyId}`}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={14} />
                              Xem
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <EmployeePhotoUpload
                  // Danh sách thiết bị đổi (vừa bổ sung xong) -> tạo mới form,
                  // xoá ảnh đã chọn của lần trước.
                  key={group.items.map((item) => item.historyId).join(",")}
                  employeeId={group.employee.id}
                  returnTo={selfHref}
                  devices={group.items.map((item) => ({
                    historyId: item.historyId,
                    label: `${item.asset.assetTag} — ${item.asset.model.brand} ${item.asset.model.modelName}`,
                  }))}
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function StatusBadge({
  status,
  overdueCount,
}: {
  status: HandoverPhotoStatus;
  overdueCount?: number;
}) {
  if (status.kind === "overdue") {
    return (
      <span className="flex w-fit items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
        <TriangleAlert size={11} />
        {overdueCount && overdueCount > 1
          ? `${overdueCount} thiết bị quá hạn`
          : `Quá hạn ${status.daysOverdue} ngày`}
      </span>
    );
  }

  if (status.kind === "pending") {
    return (
      <span className="flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
        <TriangleAlert size={11} />
        Còn {status.daysRemaining} ngày
      </span>
    );
  }

  return null;
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "amber" | "rose" | "slate";
}) {
  const box =
    tone === "rose"
      ? "border-rose-200 bg-rose-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-white";
  const iconBox =
    tone === "rose"
      ? "bg-rose-100 text-rose-600"
      : tone === "amber"
        ? "bg-amber-100 text-amber-600"
        : "bg-slate-100 text-slate-400";
  const text =
    tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  const sub =
    tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-slate-500";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${box}`}>
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${iconBox}`}>
        {icon}
      </div>
      <div className={`text-2xl font-extrabold ${text}`}>{value}</div>
      <p className={`mt-1 text-sm font-semibold ${sub}`}>{label}</p>
    </div>
  );
}
