import AppLayout from "../components/AppLayout";
import { requireLogin } from "@/modules/auth/auth.service";
import { resolveWarehouseFilter } from "@/modules/warehouse/warehouse.service";
import {
  resolvePeriod,
  getStockInReport,
  getIssuedReport,
} from "@/modules/report/report.service";
import WarehouseFilterSelect from "../components/WarehouseFilterSelect";
import { scopedWarehouseCount } from "@/lib/warehouse-filter";
import ReportPeriodSelect from "./ReportPeriodSelect";
import LocalDateTime from "../components/LocalDateTime";
import { PackagePlus, UserCheck, Boxes, Users } from "lucide-react";

// Trang Báo cáo Nhập - Xuất theo kỳ (Tháng/Năm) — tổng kết trong kỳ đã chọn:
// (1) nhập kho được những thiết bị gì (theo model + danh sách chi tiết), và
// (2) đã xuất/cấp phát thiết bị nào cho nhân viên nào. Mở cho cả 3 role xem
// (kế toán/FC dùng role User để tra cứu) — không có thao tác ghi ở trang này.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    year?: string;
    month?: string;
    warehouseId?: string;
    regionId?: string;
  }>;
}) {
  const currentUser = await requireLogin();
  const {
    mode: modeParam,
    year: yearParam,
    month: monthParam,
    warehouseId: warehouseIdParam,
    regionId: regionIdParam,
  } = await searchParams;

  const now = new Date();
  const mode: "month" | "year" = modeParam === "year" ? "year" : "month";
  const year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear();
  const month = monthParam
    ? Number(monthParam) || now.getMonth() + 1
    : now.getMonth() + 1;

  const period = resolvePeriod(mode, year, month);

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

  const [stockIn, issued] = await Promise.all([
    getStockInReport(period, effectiveWarehouseIds),
    getIssuedReport(period, effectiveWarehouseIds),
  ]);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Báo cáo Nhập - Xuất</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tổng kết thiết bị đã nhập kho và đã cấp phát cho nhân viên trong{" "}
            {period.label.toLowerCase()}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ReportPeriodSelect mode={mode} year={year} month={month} />

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

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <PackagePlus size={20} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {stockIn.totalCount}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Thiết bị đã nhập kho
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <UserCheck size={20} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {issued.totalCount}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Thiết bị đã cấp phát
          </p>
        </div>
      </div>

      {/* NHẬP KHO — tổng hợp theo model */}
      <section className="mb-8">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
          <Boxes size={18} className="text-emerald-600" />
          Nhập kho theo model
        </h3>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* max-h-[570px] ~ vừa đủ hiển thị 10 dòng dữ liệu (mỗi dòng
              ~52px) + phần header — nhiều hơn thì tự cuộn riêng bên trong
              khung này thay vì kéo dài cả trang, tránh trang quá dài khi xem
              theo Năm (dữ liệu có thể lên tới hàng trăm dòng). Header
              "sticky" để vẫn thấy tên cột khi đang cuộn xuống giữa bảng. */}
          <div className="max-h-[570px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 text-left">Model</th>
                  <th className="p-4 text-left">Hãng</th>
                  <th className="p-4 text-left">Loại thiết bị</th>
                  <th className="p-4 text-right">Số lượng nhập</th>
                </tr>
              </thead>
              <tbody>
                {stockIn.byModel.map((m) => (
                  <tr key={m.modelId} className="border-t border-slate-100">
                    <td className="p-4 font-semibold text-slate-900">
                      {m.modelName}
                    </td>
                    <td className="p-4 text-slate-600">{m.brand}</td>
                    <td className="p-4 text-slate-600">{m.categoryName ?? "-"}</td>
                    <td className="p-4 text-right font-bold text-emerald-700">
                      {m.quantity}
                    </td>
                  </tr>
                ))}

                {stockIn.byModel.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-400">
                      Không có thiết bị nào được nhập trong {period.label.toLowerCase()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* NHẬP KHO — danh sách chi tiết */}
      <section className="mb-8">
        <h3 className="mb-3 text-lg font-bold text-slate-900">
          Danh sách thiết bị đã nhập
        </h3>

        {/* Thống kê SL theo Loại phiếu — tổng nhanh Mua mới/Thu hồi của kỳ
            đang xem, khỏi phải tự đếm dòng trong bảng dài bên dưới. */}
        {stockIn.byStockInType.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {stockIn.byStockInType.map((t) => (
              <span
                key={t.type}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                {t.label}:
                <span className="font-bold text-slate-900">{t.quantity}</span>
              </span>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[570px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 text-left">Ngày nhập</th>
                  <th className="p-4 text-left">Asset Tag</th>
                  <th className="p-4 text-left">Model</th>
                  <th className="p-4 text-left">Serial</th>
                  <th className="p-4 text-left">Kho</th>
                  <th className="p-4 text-left">Loại phiếu</th>
                  <th className="p-4 text-left">Thu hồi từ</th>
                </tr>
              </thead>
              <tbody>
                {stockIn.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-4 text-slate-600">
                      <LocalDateTime value={item.stockInSlip.stockInDate} mode="date" />
                    </td>
                    <td className="p-4 font-bold text-slate-900">
                      {item.asset.assetTag}
                    </td>
                    <td className="p-4">
                      {item.asset.model.brand} {item.asset.model.modelName}
                    </td>
                    <td className="p-4 text-slate-600">{item.asset.serialNumber}</td>
                    <td className="p-4">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {item.asset.warehouse
                          ? `${item.asset.warehouse.code} - ${item.asset.warehouse.name}`
                          : "-"}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {item.stockInSlip.stockInType === "NEW_PURCHASE"
                        ? "Mua mới"
                        : "Thu hồi"}
                    </td>
                    <td className="p-4">
                      {/* Chỉ phiếu Thu hồi mới có nguồn — Mua mới luôn để
                          trống theo đúng yêu cầu. */}
                      {item.recalledFromEmployee ? (
                        <span className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                          {item.recalledFromEmployee.fullName}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {stockIn.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CẤP PHÁT — tổng hợp theo nhân viên */}
      <section className="mb-8">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
          <Users size={18} className="text-blue-600" />
          Cấp phát theo nhân viên
        </h3>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[570px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 text-left">Nhân viên</th>
                  <th className="p-4 text-left">Team</th>
                  <th className="p-4 text-right">Số lượng nhận</th>
                </tr>
              </thead>
              <tbody>
                {issued.byEmployee.map((e) => (
                  <tr key={e.employeeId} className="border-t border-slate-100">
                    <td className="p-4 font-semibold text-slate-900">
                      {e.fullName}
                    </td>
                    <td className="p-4 text-slate-600">{e.teamName ?? "-"}</td>
                    <td className="p-4 text-right font-bold text-blue-700">
                      {e.quantity}
                    </td>
                  </tr>
                ))}

                {issued.byEmployee.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-slate-400">
                      Không có thiết bị nào được cấp phát trong{" "}
                      {period.label.toLowerCase()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CẤP PHÁT — danh sách chi tiết */}
      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-900">
          Danh sách thiết bị đã cấp phát
        </h3>

        {/* Thống kê SL theo Lý do cấp phát — cùng kiểu tóm tắt với bảng
            "Danh sách thiết bị đã nhập" ở trên. */}
        {issued.byReason.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {issued.byReason.map((r) => (
              <span
                key={r.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                {r.label}:
                <span className="font-bold text-slate-900">{r.quantity}</span>
              </span>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[570px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 text-left">Ngày cấp</th>
                  <th className="p-4 text-left">S/N</th>
                  <th className="p-4 text-left">Model</th>
                  <th className="p-4 text-left">Nhân viên nhận</th>
                  <th className="p-4 text-left">Kho</th>
                  <th className="p-4 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {issued.items.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="p-4 text-slate-600">
                      <LocalDateTime value={h.createdAt} mode="date" />
                    </td>
                    <td className="p-4 font-bold text-slate-900">
                      {h.asset.serialNumber}
                    </td>
                    <td className="p-4">
                      {h.asset.model.brand} {h.asset.model.modelName}
                    </td>
                    <td className="p-4 text-slate-600">
                      {h.employee?.fullName ?? "-"}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {h.asset.warehouse
                          ? `${h.asset.warehouse.code} - ${h.asset.warehouse.name}`
                          : "-"}
                      </span>
                    </td>
                    {/* Rút gọn chỉ còn lý do cấp phát (VD "Cấp nhân viên
                        mới") thay vì cả câu note đầy đủ — nội dung gốc vẫn
                        xem được khi rê chuột (title). */}
                    <td
                      className="max-w-xs truncate p-4 text-slate-500"
                      title={h.note ?? ""}
                    >
                      {h.reason}
                    </td>
                  </tr>
                ))}

                {issued.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
