import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData } from "@/modules/auth/permissions";
import { getAssetsRetired } from "@/modules/asset/asset.service";
import { resolveWarehouseFilter } from "@/modules/warehouse/warehouse.service";
import WarehouseFilterSelect from "../../components/WarehouseFilterSelect";
import { scopedWarehouseCount } from "@/lib/warehouse-filter";
import LocalDateTime from "../../components/LocalDateTime";
import ConfirmLiquidationForm from "./ConfirmLiquidationForm";
import BulkRetireModal from "./BulkRetireModal";
import { ArrowLeft, Trash2, Eye, Clock, CheckCircle2 } from "lucide-react";

export default async function LiquidationPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string; regionId?: string; tab?: string }>;
}) {
  const currentUser = await requireLogin();
  const canManage = canEditData(currentUser.role.name);
  const {
    warehouseId: warehouseIdParam,
    regionId: regionIdParam,
    tab: tabParam,
  } = await searchParams;

  // "Chờ thanh lý" = status RETIRED, liquidatedAt còn null (đã đánh dấu
  // nhưng vẫn nằm vật lý trong kho chờ xử lý). "Đã thanh lý" = liquidatedAt
  // đã có giá trị (đã xác nhận bán/huỷ thật sự, ghi rõ ai/khi nào).
  const tab = tabParam === "done" ? "done" : "pending";

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

  const allAssets = await getAssetsRetired(effectiveWarehouseIds);
  const pendingAssets = allAssets.filter((a) => !a.liquidatedAt);
  const doneAssets = allAssets.filter((a) => a.liquidatedAt);
  const assets = tab === "pending" ? pendingAssets : doneAssets;

  const tabQuery = (nextTab: "pending" | "done") => ({
    ...(selectedWarehouseId ? { warehouseId: String(selectedWarehouseId) } : {}),
    ...(selectedRegion ? { regionId: String(selectedRegion.id) } : {}),
    ...(nextTab === "done" ? { tab: "done" } : {}),
  });

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
          <h2 className="text-2xl font-bold text-slate-900">Kho thanh lý</h2>
          <p className="mt-1 text-sm text-slate-500">
            Thiết bị đã đưa ra khỏi kho hoạt động để thanh lý — không còn
            tính vào tồn kho khả dụng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canManage && <BulkRetireModal />}

          {(!regionWarehouseIds ||
            scopedWarehouseCount(allRegions, unassignedWarehouses) > 1) && (
            <WarehouseFilterSelect
              regions={allRegions}
              unassignedWarehouses={unassignedWarehouses}
              selectedWarehouseId={selectedWarehouseId}
              selectedRegionId={selectedRegion?.id ?? null}
            />
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Clock size={20} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {pendingAssets.length}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Đang chờ thanh lý
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <CheckCircle2 size={20} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {doneAssets.length}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Đã thanh lý xong
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href={{ pathname: "/assets/liquidation", query: tabQuery("pending") }}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "pending"
              ? "bg-amber-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Chờ thanh lý ({pendingAssets.length})
        </Link>

        <Link
          href={{ pathname: "/assets/liquidation", query: tabQuery("done") }}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "done"
              ? "bg-slate-800 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Đã thanh lý ({doneAssets.length})
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Asset Tag</th>
              <th className="p-4 text-left">Model</th>
              <th className="p-4 text-left">Serial</th>
              <th className="p-4 text-left">Kho</th>
              <th className="p-4 text-left">Lý do thanh lý</th>
              <th className="p-4 text-left">Người đánh dấu</th>
              <th className="p-4 text-left">Ngày chuyển</th>
              {tab === "done" && (
                <>
                  <th className="p-4 text-left">Người xác nhận</th>
                  <th className="p-4 text-left">Ngày xác nhận</th>
                </>
              )}
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="border-t border-slate-100 transition hover:bg-slate-50"
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

                <td className="p-4 text-slate-600">{asset.retireNote ?? "-"}</td>

                <td className="p-4 text-slate-600">{asset.retiredBy ?? "-"}</td>

                <td className="p-4">
                  <LocalDateTime value={asset.retiredAt} mode="datetime" />
                </td>

                {tab === "done" && (
                  <>
                    {/* Người/ngày xác nhận lưu thẳng trên Asset
                        (liquidatedBy/liquidatedAt, set bởi
                        confirmLiquidationAction) — tách biệt hoàn toàn với
                        "Người đánh dấu"/"Ngày chuyển" ở 2 cột phía trên (vẫn
                        luôn là thông tin của lần đánh dấu Chờ thanh lý ban
                        đầu, không bị ghi đè khi xác nhận xong). */}
                    <td className="p-4 text-slate-600">{asset.liquidatedBy ?? "-"}</td>
                    <td className="p-4">
                      {asset.liquidatedAt ? (
                        <LocalDateTime value={asset.liquidatedAt} mode="datetime" />
                      ) : (
                        "-"
                      )}
                    </td>
                  </>
                )}

                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/assets/${asset.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={16} />
                      Xem
                    </Link>

                    {tab === "pending" && canManage && (
                      <ConfirmLiquidationForm assetId={asset.id} />
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {assets.length === 0 && (
              <tr>
                <td colSpan={tab === "done" ? 10 : 8} className="p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Trash2 size={28} />
                    </div>
                    <p className="font-bold text-slate-700">
                      {tab === "pending"
                        ? "Chưa có thiết bị nào chờ thanh lý"
                        : "Chưa có thiết bị nào đã thanh lý xong"}
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
