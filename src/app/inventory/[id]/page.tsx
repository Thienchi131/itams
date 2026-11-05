import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardCheck, TriangleAlert } from "lucide-react";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import { getAssetStatusLabel } from "@/modules/asset/asset.helpers";
import {
  canAccessInventoryAudit,
  getInventoryAuditDetail,
} from "@/modules/inventory/inventory.service";
import {
  INVENTORY_SCOPE_LABEL,
  INVENTORY_STATUS_LABEL,
} from "@/modules/inventory/inventory.helpers";
import LocalDateTime from "../../components/LocalDateTime";
import ConfirmActionButton from "../../components/ConfirmActionButton";
import InventoryChecklist, { type ChecklistItem } from "./InventoryChecklist";
import { cancelInventoryAuditAction, completeInventoryAuditAction } from "../actions";

export default async function InventoryAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireRole(["Admin", "IT"]);
  const { id } = await params;
  const auditId = Number(id);
  if (!Number.isInteger(auditId) || auditId <= 0) notFound();

  const audit = await getInventoryAuditDetail(auditId);
  if (!audit) notFound();

  // IT không được chọn tham gia / ngoài phạm vi kho -> 404 (không lộ là đợt
  // có tồn tại). Admin xem được mọi đợt trong phạm vi kho.
  if (!canAccessInventoryAudit(currentUser, audit)) {
    notFound();
  }

  const isOpen = audit.status === "IN_PROGRESS";
  const isAdmin = currentUser.role.name === ROLE_ADMIN;
  const total = audit.items.length;
  const confirmed = audit.items.filter((item) => item.confirmedAt).length;
  const missing = total - confirmed;
  const percent = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  const items: ChecklistItem[] = audit.items.map((item) => {
    // Thiết bị đã đổi trạng thái/rời kho sau khi tạo đợt (VD vừa bàn giao
    // cho nhân viên) — ghi chú để IT/Admin hiểu vì sao có thể không thấy máy.
    let changedNote: string | null = null;
    if (!item.asset) {
      changedNote = "Thiết bị đã bị xoá khỏi hệ thống.";
    } else {
      const stillInScope =
        item.asset.warehouseId === audit.warehouseId &&
        (audit.scope === "IN_STOCK"
          ? item.asset.status === "IN_STOCK"
          : item.asset.status === "RETIRED" && item.asset.liquidatedAt === null);
      if (!stillInScope) {
        changedNote =
          item.asset.warehouseId !== audit.warehouseId
            ? `Đã chuyển khỏi kho sau khi tạo đợt (hiện: ${getAssetStatusLabel(item.asset.status)}).`
            : `Đã đổi trạng thái sau khi tạo đợt (hiện: ${
                item.asset.liquidatedAt ? "Đã thanh lý" : getAssetStatusLabel(item.asset.status)
              }).`;
      }
    }

    return {
      id: item.id,
      assetId: item.asset?.id ?? null,
      assetTag: item.assetTag,
      serialNumber: item.serialNumber,
      modelLabel: item.modelLabel,
      confirmedAt: item.confirmedAt?.toISOString() ?? null,
      confirmedBy: item.confirmedBy,
      hasPhoto: Boolean(item.photoFileName),
      changedNote,
    };
  });

  return (
    <AppLayout>
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Danh sách đợt kiểm kê
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">
              Kiểm kê #{audit.id} — {audit.warehouseLabel}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                audit.status === "IN_PROGRESS"
                  ? "bg-blue-100 text-blue-700"
                  : audit.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {INVENTORY_STATUS_LABEL[audit.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {INVENTORY_SCOPE_LABEL[audit.scope]} · Tạo bởi {audit.createdBy ?? "-"} lúc{" "}
            <LocalDateTime value={audit.createdAt} mode="datetime" />
            {audit.completedAt && (
              <>
                {" "}
                · {audit.status === "CANCELLED" ? "Huỷ" : "Hoàn tất"} bởi {audit.completedBy ?? "-"}{" "}
                lúc <LocalDateTime value={audit.completedAt} mode="datetime" />
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            IT tham gia:{" "}
            <span className="font-semibold">
              {audit.participants.map((p) => p.user.fullName).join(", ") || "-"}
            </span>
          </p>
          {audit.note && <p className="mt-1 text-sm text-slate-600">Ghi chú: {audit.note}</p>}
        </div>

        {isOpen && (
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <form action={cancelInventoryAuditAction}>
                <input type="hidden" name="auditId" value={audit.id} />
                <ConfirmActionButton
                  label="Huỷ đợt"
                  color="rose"
                  confirmTitle="Huỷ đợt kiểm kê?"
                  confirmMessage="Đợt kiểm kê sẽ bị huỷ (vẫn giữ lại để tra cứu). Dùng khi tạo nhầm đợt."
                  confirmLabel="Huỷ đợt"
                />
              </form>
            )}
            <form action={completeInventoryAuditAction}>
              <input type="hidden" name="auditId" value={audit.id} />
              <ConfirmActionButton
                label="Hoàn tất kiểm kê"
                icon={<ClipboardCheck size={16} />}
                confirmTitle="Hoàn tất đợt kiểm kê?"
                confirmMessage={
                  missing > 0
                    ? `Còn ${missing}/${total} thiết bị CHƯA được xác nhận — sẽ được ghi là THIẾU trong báo cáo. Sau khi hoàn tất không thể chụp thêm.`
                    : `Đã xác nhận đủ ${total}/${total} thiết bị. Sau khi hoàn tất không thể chụp thêm.`
                }
                confirmLabel="Hoàn tất"
              />
            </form>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Tổng thiết bị</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} />
            Đã xác nhận
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">
            {confirmed} <span className="text-base font-bold">({percent}%)</span>
          </p>
        </div>
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            missing > 0
              ? isOpen
                ? "border-amber-200 bg-amber-50"
                : "border-rose-200 bg-rose-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <p
            className={`flex items-center gap-1.5 text-sm font-semibold ${
              missing > 0 ? (isOpen ? "text-amber-700" : "text-rose-700") : "text-slate-500"
            }`}
          >
            <TriangleAlert size={16} />
            {isOpen ? "Chưa xác nhận" : "Thiếu"}
          </p>
          <p
            className={`mt-1 text-2xl font-extrabold ${
              missing > 0 ? (isOpen ? "text-amber-700" : "text-rose-700") : "text-slate-900"
            }`}
          >
            {missing}
          </p>
        </div>
      </div>

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>

      <InventoryChecklist
        auditId={audit.id}
        items={items}
        canConfirm={isOpen}
        currentUserName={currentUser.fullName}
        isFinished={!isOpen}
      />
    </AppLayout>
  );
}
