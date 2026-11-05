"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, TriangleAlert, X } from "lucide-react";
import {
  HANDOVER_PHOTO_FIELD,
  HANDOVER_PHOTO_JPEG_QUALITY,
  HANDOVER_PHOTO_MAX_BYTES,
  HANDOVER_PHOTO_MAX_DIMENSION,
} from "@/modules/asset/handover-photo.helpers";

// Chọn/chụp ảnh xác nhận bàn giao + NÉN TỰ ĐỘNG ngay trên trình duyệt trước
// khi gửi lên server: ảnh iPhone gốc 2–5 MB (HEIC/JPEG 12–48MP) -> JPEG cạnh
// dài tối đa 1600px, chất lượng 75% (~200–400 KB). IT không phải làm gì thêm.
// Vẽ lại qua <canvas> cũng tự xoay đúng chiều và bỏ toàn bộ EXIF (GPS, thông
// tin máy chụp...). Server vẫn kiểm tra lại (JPEG thật + dung lượng), xem
// handover-photo.service.ts.

type PickedPhoto = { file: File; url: string };

async function loadImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("decode");
  }
  return { image, url };
}

async function compressImage(file: File): Promise<File> {
  const { image, url } = await loadImage(file);

  try {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error("decode");

    const scale = Math.min(1, HANDOVER_PHOTO_MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");

    // Nền trắng — ảnh PNG có vùng trong suốt khi xuất JPEG không bị đen.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", HANDOVER_PHOTO_JPEG_QUALITY)
    );

    // Giải phóng bộ nhớ canvas sớm — Safari iOS giới hạn tổng bộ nhớ canvas.
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) throw new Error("encode");

    return new File([blob], `ban-giao-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useHandoverPhotoPicker(maxCount: number) {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thu hồi object URL của ảnh xem trước khi component bị huỷ.
  const photosRef = useRef<PickedPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) return;

      setError(null);

      const slots = maxCount - photosRef.current.length;
      if (slots <= 0) {
        setError(`Tối đa ${maxCount} ảnh.`);
        return;
      }

      const accepted = files.slice(0, slots);
      if (files.length > slots) {
        setError(`Chỉ thêm được ${slots} ảnh nữa (tối đa ${maxCount} ảnh) — đã bỏ bớt ảnh thừa.`);
      }

      setBusy(true);
      const added: PickedPhoto[] = [];
      let failed = 0;

      // Nén LẦN LƯỢT từng ảnh (không song song) — tránh tràn bộ nhớ trên
      // iPhone khi chọn nhiều ảnh 48MP cùng lúc.
      for (const file of accepted) {
        try {
          const compressed = await compressImage(file);
          if (compressed.size > HANDOVER_PHOTO_MAX_BYTES) {
            failed++;
            continue;
          }
          added.push({ file: compressed, url: URL.createObjectURL(compressed) });
        } catch {
          failed++;
        }
      }

      if (failed > 0) {
        setError(
          `Không đọc được ${failed} ảnh — hãy chọn ảnh định dạng JPG/PNG hoặc chụp trực tiếp bằng camera.`
        );
      }

      setPhotos((prev) => [...prev, ...added]);
      setBusy(false);
    },
    [maxCount]
  );

  const remove = useCallback((index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /** Gắn ảnh đã nén vào FormData trước khi gọi server action. */
  const appendTo = useCallback((formData: FormData) => {
    formData.delete(HANDOVER_PHOTO_FIELD);
    photosRef.current.forEach((photo) =>
      formData.append(HANDOVER_PHOTO_FIELD, photo.file, photo.file.name)
    );
  }, []);

  return { photos, busy, error, maxCount, addFiles, remove, appendTo };
}

export type HandoverPhotoPickerState = ReturnType<typeof useHandoverPhotoPicker>;

export default function HandoverPhotoPicker({
  picker,
  label = "Ảnh xác nhận bàn giao",
  hint,
  disabled = false,
}: {
  picker: HandoverPhotoPickerState;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { photos, busy, error, maxCount, addFiles, remove } = picker;
  const canAddMore = photos.length < maxCount;

  return (
    <div>
      <p className="text-xs font-bold text-slate-500">
        {label}{" "}
        <span className="font-medium text-slate-400">
          ({photos.length}/{maxCount})
        </span>
      </p>

      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước từ blob: URL cục bộ, next/image không áp dụng được */}
            <img src={photo.url} alt={`Ảnh ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={disabled}
              aria-label={`Bỏ ảnh ${index + 1}`}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || disabled}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang nén
              </>
            ) : (
              <>
                <Camera size={18} />
                Thêm ảnh
              </>
            )}
          </button>
        )}
      </div>

      {/* Không đặt name — ảnh GỐC (chưa nén) không bao giờ được gửi lên
          server; chỉ ảnh đã nén được gắn vào FormData qua picker.appendTo().
          Không dùng capture="environment" để iPhone cho chọn cả "Chụp ảnh"
          lẫn "Thư viện ảnh" (ảnh đã chụp sẵn trước đó). */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          void addFiles(files).finally(() => {
            // Reset để chọn lại cùng 1 file vẫn kích hoạt onChange.
            if (inputRef.current) inputRef.current.value = "";
          });
        }}
      />

      {error && (
        <div className="mt-1.5 flex items-center gap-2 text-xs font-medium text-rose-600">
          <TriangleAlert size={13} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
