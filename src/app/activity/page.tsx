import AppLayout from "../components/AppLayout";
import { requireLogin } from "@/modules/auth/auth.service";
import { getAssetHistories } from "@/modules/asset/history.service";
import { getEmployees } from "@/modules/employee/employee.service";
import { getHistoryActionLabel } from "@/modules/asset/asset.helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { X } from "lucide-react";
import LocalDateTime from "../components/LocalDateTime";
import Pagination from "../components/Pagination";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; assetId?: string }>;
}) {
  const currentUser = await requireLogin();

  const { page, assetId: assetIdParam } = await searchParams;
  const currentPage = Number(page ?? "1");
  const assetId = assetIdParam ? Number(assetIdParam) : null;

  const [{ histories, total, totalPages }, employees, warehouses] = await Promise.all([
    getAssetHistories(currentPage, currentUser.regionWarehouseIds, assetId),
    getEmployees(),
    prisma.warehouse.findMany({ orderBy: { code: "asc" } }),
  ]);

  const assetTag = histories[0]?.asset.assetTag;

  return (
    <AppLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Lịch sử thay đổi</h2>
        <p className="mt-1 text-slate-500">
          Toàn bộ <span className="font-bold text-slate-900">{total}</span>{" "}
          thay đổi thiết bị trên hệ thống
        </p>

        {assetId && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            Đang lọc: thiết bị {assetTag ?? `#${assetId}`}
            <Link href="/activity" className="text-blue-400 hover:text-blue-600">
              <X size={14} />
            </Link>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {histories.map((history) => {
            const fromEmployee = employees.find(
              (employee) => employee.id === history.fromEmployeeId
            );

            const toEmployee = employees.find(
              (employee) => employee.id === history.toEmployeeId
            );

            const fromWarehouse = warehouses.find(
              (w) => w.id === history.fromWarehouseId
            );

            const toWarehouse = warehouses.find(
              (w) => w.id === history.toWarehouseId
            );

            // Mỗi loại thao tác có ý nghĩa "Từ"/"Đến" khác nhau — Bàn giao là
            // từ KHO đến NHÂN VIÊN, Thu hồi là từ NHÂN VIÊN về KHO, Luân
            // chuyển kho là giữa 2 KHO. Xem chú thích đầy đủ ở Timeline trong
            // trang chi tiết thiết bị (src/app/assets/[id]/page.tsx).
            let fromDisplay = fromEmployee?.fullName ?? "";
            let toDisplay = toEmployee?.fullName ?? "";

            // "Kho - tên kho" thay vì mã kho — tránh nhầm với tên nhân viên
            // đứng cạnh (VD mã/tên kho hay trùng gần giống nhau như "RAK 1").
            const fromWarehouseLabel = fromWarehouse ? `Kho - ${fromWarehouse.name}` : "";
            const toWarehouseLabel = toWarehouse ? `Kho - ${toWarehouse.name}` : "";

            if (history.action === "WAREHOUSE_TRANSFER") {
              fromDisplay = fromWarehouseLabel;
              toDisplay = toWarehouseLabel;
            } else if (history.action === "TRANSFER") {
              fromDisplay = fromWarehouseLabel;
              toDisplay = toEmployee?.fullName ?? "";
            } else if (history.action === "RETURN") {
              fromDisplay = fromEmployee?.fullName ?? "";
              toDisplay = toWarehouseLabel;
            }

            return (
              <Link
                key={history.id}
                href={`/assets/${history.asset.id}`}
                className="flex items-center justify-between gap-6 p-5 transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {getHistoryActionLabel(history.action)} —{" "}
                    {history.asset.assetTag}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {history.note || "-"}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {fromDisplay ? `Từ: ${fromDisplay} · ` : ""}
                    {toDisplay ? `Đến: ${toDisplay} · ` : ""}
                    {history.createdBy ? `Thực hiện bởi: ${history.createdBy}` : ""}
                  </p>
                </div>

                <span className="whitespace-nowrap text-sm text-slate-400">
                  <LocalDateTime value={history.createdAt} mode="datetime" />
                </span>
              </Link>
            );
          })}

          {histories.length === 0 && (
            <p className="p-8 text-center text-slate-500">
              Chưa có thay đổi nào
            </p>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/activity"
          query={{ assetId: assetId ?? undefined }}
        />
      </div>
    </AppLayout>
  );
}
