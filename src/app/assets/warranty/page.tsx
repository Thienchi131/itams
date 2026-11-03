import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireLogin } from "@/modules/auth/auth.service";
import { getAssetsInRepair } from "@/modules/asset/asset.service";
import { OVERDUE_DAYS_THRESHOLD } from "@/modules/asset/asset.helpers";
import { resolveWarehouseFilter } from "@/modules/warehouse/warehouse.service";
import WarehouseFilterSelect from "../../components/WarehouseFilterSelect";
import LocalDateTime from "../../components/LocalDateTime";
import RepairFollowUpModal from "./RepairFollowUpModal";
import { ArrowLeft, Wrench, Eye, TriangleAlert, ClipboardCheck } from "lucide-react";

export default async function RepairTrackingPage({
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

  const assets = await getAssetsInRepair(effectiveWarehouseIds);
  const overdueCount = assets.filter(
    (asset) => asset.daysInRepair > OVERDUE_DAYS_THRESHOLD
  ).length;
  const needsFollowUpCount = assets.filter((asset) => asset.needsFollowUp).length;

  // Giữ lại filter kho/khu vực đang xem khi RepairFollowUpModal redirect về
  // lại đúng trang này sau khi lưu hướng xử lý (Gia hạn sửa chữa) — chỉ
  // "Sửa xong"/"Không sửa được" mới nhảy qua trang chi tiết thiết bị (đi qua
  // completeRepairAction có sẵn, hành vi này giữ nguyên như cũ).
  const returnTo = warehouseIdParam
    ? `/assets/warranty?warehouseId=${warehouseIdParam}`
    : regionIdParam
      ? `/assets/warranty?regionId=${regionIdParam}`
      : "/assets/warranty";

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
          <h2 className="text-2xl font-bold text-slate-900">Theo dõi sửa chữa</h2>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách thiết bị đã thu hồi và đang gửi sửa chữa/bảo hành — theo
            dõi để nhắc thu hồi lại khi sửa xong.
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
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Wrench size={20} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{assets.length}</div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Thiết bị đang sửa chữa/bảo hành
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
            Quá {OVERDUE_DAYS_THRESHOLD} ngày chưa hoàn tất
          </p>
        </div>

        {/* Tách riêng khỏi thẻ "Quá X ngày chưa hoàn tất" ở trên — thẻ đó chỉ
            đếm máy quá hạn SỬA CHỮA, còn thẻ này đếm máy quá hạn MÀ CHƯA
            (hoặc đã hết hạn) điền hướng xử lý, tức là danh sách IT thực sự
            còn phải bấm "Cập nhật hướng xử lý" ngay bây giờ (xem
            RepairFollowUpModal + banner trong AppLayout). */}
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            needsFollowUpCount > 0
              ? "border-rose-200 bg-rose-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div
            className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${
              needsFollowUpCount > 0
                ? "bg-rose-100 text-rose-600"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            <ClipboardCheck size={20} />
          </div>
          <div
            className={`text-2xl font-extrabold ${
              needsFollowUpCount > 0 ? "text-rose-700" : "text-slate-900"
            }`}
          >
            {needsFollowUpCount}
          </div>
          <p
            className={`mt-1 text-sm font-semibold ${
              needsFollowUpCount > 0 ? "text-rose-600" : "text-slate-500"
            }`}
          >
            Cần cập nhật hướng xử lý
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
              <th className="p-4 text-left">Lý do gửi</th>
              <th className="p-4 text-left">Người gửi</th>
              <th className="p-4 text-left">Ngày gửi</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="border-t border-slate-100 transition hover:bg-amber-50/40"
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

                <td className="p-4 text-slate-600">{asset.repairNote ?? "-"}</td>

                <td className="p-4 text-slate-600">{asset.repairSentBy ?? "-"}</td>

                <td className="p-4">
                  {asset.repairSentAt ? (
                    <LocalDateTime value={asset.repairSentAt} mode="datetime" />
                  ) : (
                    "-"
                  )}

                  {asset.daysInRepair > OVERDUE_DAYS_THRESHOLD && (
                    <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                      <TriangleAlert size={11} />
                      Quá {asset.daysInRepair} ngày
                    </span>
                  )}

                  {/* Đã điền hướng xử lý và còn hiệu lực (chưa tới hạn 14
                      ngày phải cập nhật lại) — chỉ hiện khi máy vẫn đang quá
                      hạn nhưng KHÔNG còn needsFollowUp, để phân biệt rõ với
                      badge đỏ "Quá X ngày" ở trên (đó là hạn sửa chữa, còn
                      badge này là hạn điền lại hướng xử lý — 2 mốc khác
                      nhau). */}
                  {asset.daysInRepair > OVERDUE_DAYS_THRESHOLD &&
                    !asset.needsFollowUp &&
                    asset.latestFollowUp && (
                      <span
                        className="mt-1 flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700"
                        title={asset.latestFollowUp.note}
                      >
                        <ClipboardCheck size={11} />
                        Đã có hướng xử lý
                      </span>
                    )}
                </td>

                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {asset.needsFollowUp && (
                      <RepairFollowUpModal
                        assetId={asset.id}
                        assetTag={asset.assetTag}
                        daysInRepair={asset.daysInRepair}
                        returnTo={returnTo}
                      />
                    )}

                    <Link
                      href={`/assets/${asset.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={16} />
                      Xem
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Wrench size={28} />
                    </div>
                    <p className="font-bold text-slate-700">
                      Không có thiết bị nào đang sửa chữa/bảo hành
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
