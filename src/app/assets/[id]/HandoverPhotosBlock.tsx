"use client";

import { useActionState, useState } from "react";
import { Camera, ImageIcon, Trash2, TriangleAlert } from "lucide-react";
import HandoverPhotoPicker, {
  useHandoverPhotoPicker,
} from "@/app/components/HandoverPhotoPicker";
import LocalDateTime from "@/app/components/LocalDateTime";
import {
  HANDOVER_PHOTO_MAX_COUNT,
  type HandoverPhotoStatus,
} from "@/modules/asset/handover-photo.helpers";
import {
  addHandoverPhotosAction,
  deleteHandoverPhotoAction,
  type HandoverPhotoActionState,
} from "./handover-photo-actions";

type Photo = { id: number; uploadedBy: string | null; createdAt: string };

// Khối ảnh xác nhận ngay dưới 1 dòng "Bàn giao" ở Timeline: trạng thái hạn
// bổ sung 7 ngày, ảnh đã có (bấm để xem cỡ lớn), nút bổ sung ảnh (Admin/IT)
// và xoá ảnh chụp nhầm (chỉ Admin).
export default function HandoverPhotosBlock({
  historyId,
  returnTo,
  photos,
  status,
  photoDueAt,
  canUpload,
  canDelete,
}: {
  historyId: number;
  returnTo: string;
  photos: Photo[];
  // Tính sẵn ở server (không tính lại bằng Date.now() ở client) để server
  // render và client hydrate ra cùng 1 kết quả.
  status: HandoverPhotoStatus;
  photoDueAt: string | null;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const remaining = HANDOVER_PHOTO_MAX_COUNT - photos.length;
  const [open, setOpen] = useState(false);
  const photoPicker = useHandoverPhotoPicker(Math.max(0, remaining));
  const [state, formAction, isPending] = useActionState<HandoverPhotoActionState, FormData>(
    addHandoverPhotosAction,
    null
  );

  // Lượt bàn giao cũ (trước khi có tính năng), chưa có ảnh và không được
  // phép bổ sung (User xem) — không hiện gì để Timeline không bị rối.
  if (status.kind === "none" && photos.length === 0 && !canUpload) return null;

  return (
    <div id={`handover-${historyId}`} className="mt-3 rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <ImageIcon size={14} />
          Ảnh xác nhận bàn giao
        </span>

        {status.kind === "done" && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
            Đã có {photos.length} ảnh
          </span>
        )}

        {status.kind === "pending" && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            <TriangleAlert size={11} />
            Chưa có ảnh —{" "}
            còn {status.daysRemaining} ngày
            {photoDueAt && (
              <>
                {" "}(hạn <LocalDateTime value={photoDueAt} mode="date" />)
              </>
            )}
          </span>
        )}

        {status.kind === "overdue" && (
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
            <TriangleAlert size={11} />
            Chưa có ảnh — quá hạn {status.daysOverdue} ngày
          </span>
        )}

        {canUpload && remaining > 0 && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50"
          >
            <Camera size={14} />
            Bổ sung ảnh
          </button>
        )}
      </div>

      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative">
              <a
                href={`/handover-photos/${photo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Tải lên bởi ${photo.uploadedBy ?? "-"}`}
                className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh phục vụ qua route có kiểm quyền, không qua bộ tối ưu ảnh của Next */}
                <img
                  src={`/handover-photos/${photo.id}`}
                  alt={`Ảnh bàn giao ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </a>

              {canDelete && (
                <form action={deleteHandoverPhotoAction} className="absolute right-1 top-1">
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    aria-label={`Xoá ảnh ${index + 1}`}
                    onClick={(e) => {
                      if (!window.confirm("Xoá ảnh bàn giao này? Thao tác không hoàn tác được.")) {
                        e.preventDefault();
                      }
                    }}
                    className="rounded-full bg-black/60 p-1 text-white hover:bg-rose-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Ảnh mới nhất tải lên bởi {photos[photos.length - 1].uploadedBy ?? "-"} lúc{" "}
          <LocalDateTime value={photos[photos.length - 1].createdAt} mode="datetime" />
        </p>
      )}

      {canUpload && open && remaining > 0 && (
        <form
          action={(formData) => {
            photoPicker.appendTo(formData);
            formAction(formData);
          }}
          className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3"
        >
          <input type="hidden" name="historyId" value={historyId} />
          <input type="hidden" name="returnTo" value={returnTo} />

          <HandoverPhotoPicker
            picker={photoPicker}
            label="Chọn ảnh bổ sung"
            disabled={isPending}
          />

          {state?.error && (
            <div className="flex items-center gap-2 text-xs font-medium text-rose-600">
              <TriangleAlert size={13} className="shrink-0" />
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isPending || photoPicker.busy || photoPicker.photos.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Đang tải lên..." : `Lưu ${photoPicker.photos.length || ""} ảnh`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
