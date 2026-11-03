import AppLayout from "../../../components/AppLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/modules/auth/auth.service";
import {
  getStockInSlipById,
  checkSlipDeletable,
} from "@/modules/stockIn/stockIn.service";
import { deleteStockInSlipAction } from "../actions";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import LocalDateTime from "@/app/components/LocalDateTime";
import { truncateSerial } from "@/lib/format";
import {
  ArrowLeft,
  Trash2,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";

export default async function StockInSlipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["Admin"]);

  const { id } = await params;
  const slipId = Number(id);

  const slip = await getStockInSlipById(slipId);
  if (!slip) notFound();

  const { blockedAssets } = await checkSlipDeletable(slipId);
  const blockedAssetIds = new Set(blockedAssets.map((a) => a.id));
  const blockedReasonById = new Map(blockedAssets.map((a) => [a.id, a.reason]));

  const canDelete = blockedAssets.length === 0;

  return (
    <AppLayout>
      <Link
        href="/settings/stock-in-slips"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại danh sách phiếu nhập
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{slip.slipNo}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {slip.stockInType === "RETURNED" ? "Thu hồi" : "Mua mới"} ·{" "}
            {slip.warehouses.length === 0
              ? "Chưa gán kho"
              : slip.warehouses.length === 1
              ? `${slip.warehouses[0].code} - ${slip.warehouses[0].name}`
              : `${slip.warehouses.length} kho: ${slip.warehouses
                  .map((w) => w.code)
                  .join(", ")}`}{" "}
            · Tạo bởi {slip.createdBy ?? "-"} lúc{" "}
            <LocalDateTime value={slip.createdAt} />
          </p>
          {slip.note && (
            <p className="mt-1 text-xs text-slate-400">Ghi chú: {slip.note}</p>
          )}
        </div>

        {canDelete ? (
          <form action={deleteStockInSlipAction}>
            <input type="hidden" name="id" value={slip.id} />
            <ConfirmActionButton
              label="Xoá phiếu này"
              confirmTitle="Xác nhận xoá phiếu nhập"
              confirmMessage={`Xoá phiếu ${slip.slipNo} sẽ xoá luôn toàn bộ ${slip.items.length} thiết bị của phiếu này. Bạn có chắc chắn?`}
              confirmLabel="Xoá"
              color="rose"
              icon={<Trash2 size={15} />}
            />
          </form>
        ) : (
          <span
            title="Còn thiết bị đã cấp phát/thay đổi trong phiếu — không thể xoá"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-300"
          >
            <Trash2 size={15} />
            Xoá phiếu này
          </span>
        )}
      </div>

      {!canDelete && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="shrink-0" />
            {blockedAssets.length} thiết bị trong phiếu này không còn nguyên trạng — cần tự xử lý (thu hồi/chuyển kho) trước khi xoá được cả phiếu.
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Asset Tag</th>
              <th className="p-4 text-left">Serial</th>
              <th className="p-4 text-left">Thiết bị</th>
              <th className="p-4 text-left">Kho hiện tại</th>
              <th className="p-4 text-left">Trạng thái</th>
              <th className="p-4 text-left">Đang giữ</th>
              <th className="p-4 text-left">Ghi chú</th>
            </tr>
          </thead>

          <tbody>
            {slip.items.map((item) => {
              const asset = item.asset;
              const blocked = blockedAssetIds.has(asset.id);

              return (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="p-4 font-semibold text-slate-900">
                    <Link
                      href={`/assets/${asset.id}`}
                      className="hover:underline"
                    >
                      {asset.assetTag}
                    </Link>
                  </td>

                  <td className="p-4 text-slate-600" title={asset.serialNumber}>
                    {truncateSerial(asset.serialNumber)}
                  </td>

                  <td className="p-4">
                    {asset.model.brand} {asset.model.modelName}
                  </td>

                  <td className="p-4 text-slate-600">
                    {asset.warehouse ? `${asset.warehouse.code} - ${asset.warehouse.name}` : "-"}
                  </td>

                  <td className="p-4">
                    {blocked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <TriangleAlert size={12} />
                        Đã thay đổi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <ShieldCheck size={12} />
                        Nguyên trạng
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-slate-600">
                    {asset.currentEmployee ? (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound size={13} className="text-slate-400" />
                        {asset.currentEmployee.fullName}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="p-4 text-xs text-slate-500">
                    {blocked ? blockedReasonById.get(asset.id) : item.note || "-"}
                  </td>
                </tr>
              );
            })}

            {slip.items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-500">
                  Phiếu này không có thiết bị nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
