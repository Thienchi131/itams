import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplyById, isLowStock } from "@/modules/supply/supply.service";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData } from "@/modules/auth/permissions";
import { ArrowLeft, Edit, TriangleAlert } from "lucide-react";
import LocalDateTime from "../../components/LocalDateTime";
import StockInForm from "./StockInForm";
import StockOutForm from "./StockOutForm";

const TRANSACTION_LABEL: Record<string, string> = {
  STOCK_IN: "Nhập kho",
  STOCK_OUT: "Xuất kho",
  ADJUST: "Điều chỉnh",
};

const TRANSACTION_COLOR: Record<string, string> = {
  STOCK_IN: "bg-emerald-100 text-emerald-700",
  STOCK_OUT: "bg-rose-100 text-rose-700",
  ADJUST: "bg-slate-100 text-slate-700",
};

export default async function SupplyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireLogin();
  const canEdit = canEditData(currentUser.role.name);

  const { id } = await params;
  const supply = await getSupplyById(Number(id));

  if (!supply) notFound();

  // IT bị gán Region chỉ xem được vật tư thuộc 1 trong các kho của Region đó.
  if (
    currentUser.regionWarehouseIds &&
    (supply.warehouseId === null ||
      !currentUser.regionWarehouseIds.includes(supply.warehouseId))
  ) {
    notFound();
  }

  const low = isLowStock(supply);

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href="/supplies"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900">
                {supply.name}
              </h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                {supply.code}
              </span>
              {supply.warehouse && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                  {supply.warehouse.code} - {supply.warehouse.name}
                </span>
              )}
            </div>
            {supply.note && <p className="mt-2 text-slate-500">{supply.note}</p>}
          </div>

          {canEdit && (
            <Link
              href={`/supplies/${supply.id}/edit`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Edit size={16} />
              Sửa thông tin
            </Link>
          )}
        </div>

        <div className={`grid gap-5 ${canEdit ? "grid-cols-3" : "grid-cols-1"}`}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Tồn kho hiện tại</p>
            <p
              className={`mt-1 flex items-center gap-2 text-3xl font-extrabold ${
                low ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {supply.quantity} {supply.unit}
              {low && <TriangleAlert size={22} />}
            </p>
            {supply.minQuantity > 0 && (
              <p className="mt-1 text-sm text-slate-400">
                Ngưỡng cảnh báo: {supply.minQuantity} {supply.unit}
              </p>
            )}
          </div>

          {canEdit && (
            <>
              <StockInForm supplyId={supply.id} />
              <StockOutForm supplyId={supply.id} maxQuantity={supply.quantity} />
            </>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-bold text-slate-900">
              Lịch sử giao dịch (20 gần nhất)
            </h3>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4 text-left">Loại</th>
                <th className="p-4 text-center">Số lượng</th>
                <th className="p-4 text-left">Ghi chú</th>
                <th className="p-4 text-left">Thực hiện bởi</th>
                <th className="p-4 text-left">Thời gian</th>
              </tr>
            </thead>

            <tbody>
              {supply.transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-slate-100">
                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${TRANSACTION_COLOR[tx.type]}`}
                    >
                      {TRANSACTION_LABEL[tx.type] ?? tx.type}
                    </span>
                  </td>
                  <td className="p-4 text-center font-semibold">
                    {tx.type === "STOCK_OUT" ? "-" : "+"}
                    {tx.quantity}
                  </td>
                  <td className="p-4 text-slate-600">{tx.note ?? "-"}</td>
                  <td className="p-4 text-slate-600">{tx.createdBy ?? "-"}</td>
                  <td className="p-4 text-slate-500">
                    <LocalDateTime value={tx.createdAt} mode="datetime" />
                  </td>
                </tr>
              ))}

              {supply.transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Chưa có giao dịch nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
