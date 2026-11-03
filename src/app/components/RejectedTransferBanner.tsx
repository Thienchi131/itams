"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export type RejectedTransferBannerItem = {
  id: number;
  assetId: number;
  assetTag: string;
  rejectingWarehouseLabel: string | null;
};

// Banner "to" (giống banner "Xác nhận ngay" của kho đích) nhắc IT kho NGUỒN
// biết có thiết bị vừa bị từ chối và trả về kho mình — user phản hồi rằng
// chỉ có trong chuông thông báo là dễ bỏ sót, cần 1 banner nổi bật hơn. Màu
// amber để phân biệt với banner rose (sửa chữa quá hạn) và violet (chờ xác
// nhận nhập kho) — 3 banner có thể cùng hiện song song, không loại trừ
// nhau.
//
// Đây là 1 CLIENT COMPONENT (khác 2 banner còn lại, vốn thuần server) vì
// cần nút "Đã xem" để tự ẩn ngay lập tức (optimistic — không chờ mạng) và
// gọi API đánh dấu đã đọc CÙNG cơ chế với chuông thông báo
// (/api/notifications/mark-read) — bấm "Đã xem" ở đây cũng coi như đã đọc
// chuông, tránh lệch trạng thái "đã đọc" giữa 2 nơi.
export default function RejectedTransferBanner({
  items,
}: {
  items: RejectedTransferBannerItem[];
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || items.length === 0) return null;

  const shown = items.slice(0, 3);
  const extraCount = items.length - shown.length;

  async function handleDismiss() {
    // Ẩn ngay trên UI trước, không chờ request — nếu request lỗi mạng thì
    // lần load trang sau banner vẫn hiện lại (an toàn, không mất thông báo
    // thật), nhưng trải nghiệm bấm "Đã xem" luôn mượt, không bị khựng.
    setDismissed(true);
    try {
      await fetch("/api/notifications/mark-read", { method: "POST" });
    } catch (error) {
      console.error("DISMISS_REJECTED_TRANSFER_BANNER_ERROR:", error);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
      <div className="flex items-start gap-2.5 text-amber-700">
        <RotateCcw size={18} className="mt-0.5 shrink-0" />

        <p className="text-sm font-semibold">
          Có {items.length} thiết bị bị kho đích từ chối nhận, đã được trả về
          kho bạn:{" "}
          {shown.map((item, index) => (
            <span key={item.id}>
              <Link
                href={`/assets/${item.assetId}`}
                className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
              >
                {item.assetTag}
              </Link>
              {item.rejectingWarehouseLabel ? ` (từ ${item.rejectingWarehouseLabel})` : ""}
              {index < shown.length - 1 ? ", " : ""}
            </span>
          ))}
          {extraCount > 0 ? ` và ${extraCount} thiết bị khác` : ""}.
        </p>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700"
      >
        Đã xem
      </button>
    </div>
  );
}
