"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Search, TriangleAlert } from "lucide-react";
import LiveCameraCapture from "@/app/components/LiveCameraCapture";
import LocalDateTime from "@/app/components/LocalDateTime";
import { INVENTORY_PHOTO_FIELD } from "@/modules/inventory/inventory.helpers";
import { confirmInventoryItemAction } from "../actions";

export type ChecklistItem = {
  id: number;
  assetId: number | null;
  assetTag: string;
  serialNumber: string;
  modelLabel: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  hasPhoto: boolean;
  // Ghi chú khi thiết bị đã đổi trạng thái/rời kho sau lúc tạo đợt.
  changedNote: string | null;
};

type Filter = "all" | "pending" | "confirmed";

export default function InventoryChecklist({
  auditId,
  items: serverItems,
  canConfirm,
  currentUserName,
  isFinished,
}: {
  auditId: number;
  items: ChecklistItem[];
  canConfirm: boolean;
  currentUserName: string;
  // Đợt đã hoàn tất/huỷ — chế độ xem báo cáo: "Chưa xác nhận" hiển thị là "Thiếu".
  isFinished: boolean;
}) {
  const router = useRouter();
  // Xác nhận vừa chụp xong ở máy này — ghép đè lên dữ liệu từ server để
  // hiện ngay, trong lúc router.refresh() tải lại. Dữ liệu server mới (kể cả
  // máy do IT khác vừa xác nhận) luôn được dùng làm nền.
  // Gắn với đúng bộ dữ liệu server lúc tạo — khi router.refresh() trả dữ
  // liệu mới (đã gồm xác nhận vừa chụp + của IT khác) thì bỏ override cũ.
  const [overrideState, setOverrideState] = useState<{
    base: ChecklistItem[];
    map: Record<number, { confirmedAt: string; confirmedBy: string }>;
  }>({ base: serverItems, map: {} });
  const overrides = useMemo(
    () => (overrideState.base === serverItems ? overrideState.map : {}),
    [overrideState, serverItems]
  );
  const items = useMemo(
    () =>
      serverItems.map((item) =>
        overrides[item.id] ? { ...item, ...overrides[item.id], hasPhoto: true } : item
      ),
    [serverItems, overrides]
  );
  const [filter, setFilter] = useState<Filter>(isFinished ? "pending" : "all");
  const [query, setQuery] = useState("");
  const [capturing, setCapturing] = useState<ChecklistItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const confirmedCount = items.filter((item) => item.confirmedAt).length;
  const pendingCount = items.length - confirmedCount;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "pending" && item.confirmedAt) return false;
      if (filter === "confirmed" && !item.confirmedAt) return false;
      if (!q) return true;
      return `${item.assetTag} ${item.serialNumber} ${item.modelLabel}`.toLowerCase().includes(q);
    });
  }, [items, filter, query]);

  async function handleConfirm(file: File) {
    if (!capturing) return;
    setSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    formData.set("itemId", String(capturing.id));
    formData.set(INVENTORY_PHOTO_FIELD, file, file.name);

    try {
      const result = await confirmInventoryItemAction(formData);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      const itemId = capturing.id;
      setOverrideState({
        base: serverItems,
        map: {
          ...overrides,
          [itemId]: { confirmedAt: result.confirmedAt, confirmedBy: result.confirmedBy },
        },
      });
      setCapturing(null);
      // Cập nhật số liệu tiến độ ở phần đầu trang (server component).
      router.refresh();
    } catch {
      setSubmitError("Mất kết nối khi gửi ảnh, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Tất cả", count: items.length },
    { key: "pending", label: isFinished ? "Thiếu" : "Chưa xác nhận", count: pendingCount },
    { key: "confirmed", label: "Đã xác nhận", count: confirmedCount },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                filter === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <label className="relative block sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm Asset Tag / Serial / Model"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
          />
        </label>
      </div>

      <ul className="divide-y divide-slate-100">
        {visible.map((item) => {
          const confirmed = Boolean(item.confirmedAt);
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-4">
              {item.hasPhoto ? (
                <a
                  // ?v= theo thời điểm xác nhận — chụp lại (ở máy này hoặc
                  // IT khác) đổi URL nên trình duyệt tải ảnh mới.
                  href={`/inventory-photos/${item.id}?v=${encodeURIComponent(item.confirmedAt ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh phục vụ qua route có kiểm quyền */}
                  <img
                    src={`/inventory-photos/${item.id}?v=${encodeURIComponent(item.confirmedAt ?? "")}`}
                    alt={`Ảnh kiểm kê ${item.assetTag}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </a>
              ) : (
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg ${
                    isFinished ? "bg-rose-50 text-rose-500" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isFinished ? <TriangleAlert size={22} /> : <Camera size={22} />}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">
                  {item.assetId ? (
                    <a href={`/assets/${item.assetId}`} className="hover:text-blue-600">
                      {item.assetTag}
                    </a>
                  ) : (
                    item.assetTag
                  )}
                </p>
                <p className="text-sm text-slate-600">{item.modelLabel}</p>
                <p className="text-xs text-slate-500">S/N: {item.serialNumber}</p>
                {confirmed && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} />
                    {item.confirmedBy ?? "-"} ·{" "}
                    <LocalDateTime value={item.confirmedAt as string} mode="datetime" />
                  </p>
                )}
                {!confirmed && isFinished && (
                  <p className="mt-1 text-xs font-bold text-rose-600">Thiếu — không xác nhận được</p>
                )}
                {item.changedNote && (
                  <p className="mt-1 text-xs font-medium text-amber-700">{item.changedNote}</p>
                )}
              </div>

              {canConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setCapturing(item);
                  }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    confirmed
                      ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <Camera size={16} />
                  {confirmed ? "Chụp lại" : "Chụp xác nhận"}
                </button>
              )}
            </li>
          );
        })}

        {visible.length === 0 && (
          <li className="p-10 text-center text-sm text-slate-500">
            Không có thiết bị nào khớp bộ lọc.
          </li>
        )}
      </ul>

      {capturing && (
        <LiveCameraCapture
          title={`${capturing.assetTag} — ${capturing.modelLabel}`}
          watermarkLines={[
            `${capturing.assetTag} | S/N ${capturing.serialNumber}`,
            `Kiểm kê #${auditId} | ${currentUserName}`,
          ]}
          submitting={submitting}
          submitError={submitError}
          onClose={() => {
            if (!submitting) setCapturing(null);
          }}
          onConfirm={(file) => void handleConfirm(file)}
        />
      )}
    </div>
  );
}
