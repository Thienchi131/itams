"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import HandoverPhotoPicker, {
  useHandoverPhotoPicker,
} from "@/app/components/HandoverPhotoPicker";
import { HANDOVER_PHOTO_MAX_COUNT } from "@/modules/asset/handover-photo.helpers";
import {
  addHandoverPhotosForEmployeeAction,
  type HandoverPhotoActionState,
} from "../[id]/handover-photo-actions";

type Device = { historyId: number; label: string };

// Bổ sung ảnh 1 lần cho các thiết bị đang thiếu ảnh của 1 nhân viên — mặc
// định chọn hết, bỏ tick thiết bị nào không nằm trong biên bản/ảnh đang up.
export default function EmployeePhotoUpload({
  employeeId,
  devices,
  returnTo,
}: {
  employeeId: number;
  devices: Device[];
  returnTo: string;
}) {
  const [selected, setSelected] = useState<number[]>(devices.map((d) => d.historyId));
  const photoPicker = useHandoverPhotoPicker(HANDOVER_PHOTO_MAX_COUNT);
  const [state, formAction, isPending] = useActionState<HandoverPhotoActionState, FormData>(
    addHandoverPhotosForEmployeeAction,
    null
  );

  function toggle(historyId: number) {
    setSelected((prev) =>
      prev.includes(historyId) ? prev.filter((id) => id !== historyId) : [...prev, historyId]
    );
  }

  const allSelected = selected.length === devices.length;

  return (
    <form
      action={(formData) => {
        photoPicker.appendTo(formData);
        formAction(formData);
      }}
      className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="historyIds" value={selected.join(",")} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-500">
            Áp dụng ảnh cho ({selected.length}/{devices.length})
          </p>
          {devices.length > 1 && (
            <button
              type="button"
              onClick={() => setSelected(allSelected ? [] : devices.map((d) => d.historyId))}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {allSelected ? "Bỏ chọn hết" : "Chọn hết"}
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {devices.map((device) => (
            <label
              key={device.historyId}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(device.historyId)}
                onChange={() => toggle(device.historyId)}
                disabled={isPending}
                className="h-4 w-4 accent-blue-600"
              />
              {device.label}
            </label>
          ))}
        </div>
      </div>

      <HandoverPhotoPicker
        picker={photoPicker}
        label="Ảnh xác nhận bàn giao"
        hint="Ảnh up 1 lần sẽ gắn cho tất cả thiết bị đang chọn ở trên."
        disabled={isPending}
      />

      {state?.error && (
        <div className="flex items-center gap-2 text-xs font-medium text-rose-600">
          <TriangleAlert size={13} className="shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isPending ||
            photoPicker.busy ||
            photoPicker.photos.length === 0 ||
            selected.length === 0
          }
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Đang tải lên..."
            : `Lưu ảnh cho ${selected.length} thiết bị`}
        </button>
      </div>
    </form>
  );
}
