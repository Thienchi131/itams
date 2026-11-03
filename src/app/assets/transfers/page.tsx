import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireLogin } from "@/modules/auth/auth.service";
import { getPendingIncomingTransfers } from "@/modules/asset/asset.service";
import LocalDateTime from "../../components/LocalDateTime";
import ConfirmTransferButton from "./ConfirmTransferButton";
import RejectTransferModal from "./RejectTransferModal";
import { ArrowLeft, Truck, Eye, CheckCircle2 } from "lucide-react";

// Cùng pattern success=... + banner emerald đã dùng ở trang Quản lý tài sản
// (src/app/assets/page.tsx) — sau khi "Từ chối" 1 lượt luân chuyển,
// rejectWarehouseTransferAction quay về đúng trang này kèm ?success=... để
// người dùng biết thao tác đã thành công, thay vì im lặng chuyển trang.
const SUCCESS_MESSAGES: Record<string, string> = {
  transfer_rejected: "Đã từ chối nhận — thiết bị được trả lại kho nguồn.",
};

// Danh sách thiết bị đang được chuyển ĐẾN kho mà tài khoản đang đăng nhập
// phụ trách, còn chờ xác nhận nhập kho — trang này là đích đến của banner
// bắt buộc trong AppLayout.tsx (xem RepairFollowUpBanner-style banner ngay
// dưới đó cho lượt luân chuyển). Không lọc thêm theo kho cụ thể như trang
// Theo dõi sửa chữa — phạm vi đã đúng theo currentUser.regionWarehouseIds
// (null = không giới hạn, thấy hết mọi lượt đang chờ trong hệ thống).
export default async function PendingTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const currentUser = await requireLogin();
  const { success } = await searchParams;

  const transfers = await getPendingIncomingTransfers(
    currentUser.regionWarehouseIds
  );

  return (
    <AppLayout>
      <Link
        href="/assets"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Tài sản
      </Link>

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Luân chuyển kho — chờ xác nhận
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Thiết bị đang được chuyển đến kho bạn phụ trách — bấm &quot;Xác
          nhận nhập kho&quot; khi đã nhận được thiết bị thực tế, hoặc
          &quot;Từ chối&quot; nếu có nhầm lẫn.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <Truck size={20} />
        </div>
        <div className="text-2xl font-extrabold text-violet-700">
          {transfers.length}
        </div>
        <p className="mt-1 text-sm font-semibold text-violet-600">
          Thiết bị đang chờ xác nhận nhập kho
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Asset Tag</th>
              <th className="p-4 text-left">Thiết bị</th>
              <th className="p-4 text-left">Serial</th>
              <th className="p-4 text-left">Từ kho</th>
              <th className="p-4 text-left">Đến kho</th>
              <th className="p-4 text-left">Người gửi</th>
              <th className="p-4 text-left">Thời điểm gửi</th>
              <th className="p-4 text-left">Ghi chú</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {transfers.map((asset) => (
              <tr
                key={asset.id}
                className="border-t border-slate-100 transition hover:bg-violet-50/40"
              >
                <td className="p-4 font-bold text-slate-900">{asset.assetTag}</td>

                <td className="p-4">
                  {asset.model.brand} {asset.model.modelName}
                </td>

                <td className="p-4 text-slate-600">{asset.serialNumber}</td>

                <td className="p-4">
                  <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {asset.warehouse
                      ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                      : "-"}
                  </span>
                </td>

                <td className="p-4">
                  <span className="inline-flex whitespace-nowrap rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    {asset.pendingTransferToWarehouse
                      ? `${asset.pendingTransferToWarehouse.code} - ${asset.pendingTransferToWarehouse.name}`
                      : "-"}
                  </span>
                </td>

                <td className="p-4 text-slate-600">{asset.pendingTransferBy ?? "-"}</td>

                <td className="p-4">
                  {asset.pendingTransferAt ? (
                    <LocalDateTime value={asset.pendingTransferAt} mode="datetime" />
                  ) : (
                    "-"
                  )}
                </td>

                <td className="p-4 max-w-[220px] truncate text-slate-600" title={asset.pendingTransferNote ?? ""}>
                  {asset.pendingTransferNote ?? "-"}
                </td>

                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/assets/${asset.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={16} />
                      Xem
                    </Link>

                    <RejectTransferModal
                      assetId={asset.id}
                      assetTag={asset.assetTag}
                      returnTo="/assets/transfers"
                    />

                    <ConfirmTransferButton
                      assetId={asset.id}
                      assetTag={asset.assetTag}
                      toWarehouseLabel={
                        asset.pendingTransferToWarehouse
                          ? `${asset.pendingTransferToWarehouse.code} - ${asset.pendingTransferToWarehouse.name}`
                          : "kho đích"
                      }
                      returnTo="/assets/transfers"
                    />
                  </div>
                </td>
              </tr>
            ))}

            {transfers.length === 0 && (
              <tr>
                <td colSpan={9} className="p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Truck size={28} />
                    </div>
                    <p className="font-bold text-slate-700">
                      Không có thiết bị nào đang chờ xác nhận nhập kho
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
