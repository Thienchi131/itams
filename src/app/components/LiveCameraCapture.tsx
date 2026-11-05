"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import {
  INVENTORY_PHOTO_JPEG_QUALITY,
  INVENTORY_PHOTO_MAX_DIMENSION,
} from "@/modules/inventory/inventory.helpers";

// Chụp ảnh TRỰC TIẾP từ camera ngay trong trang (getUserMedia + <video>),
// KHÔNG dùng <input type="file"> — nên không có đường chọn ảnh có sẵn trong
// thư viện/máy tính. Ảnh được đóng dấu (watermark) thời gian chụp theo giờ
// máy + các dòng thông tin truyền vào (Asset Tag, S/N, người chụp...) ngay
// trên điểm ảnh, rồi thu nhỏ về cạnh dài 1600px, JPEG ~80%.

type Phase = "starting" | "live" | "preview" | "error";

export default function LiveCameraCapture({
  title,
  watermarkLines,
  submitting,
  submitError,
  onClose,
  onConfirm,
}: {
  title: string;
  watermarkLines: string[];
  submitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onConfirm: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mỗi lần mở camera tăng 1 — lần mở cũ (VD bấm "Thử lại" 2 lần, hoặc
  // StrictMode ở dev) về sau thì tự tắt luồng của nó, không bị rò camera.
  const generationRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    const generation = ++generationRef.current;
    stopStream();
    setError(null);
    setPhase((prev) => (prev === "preview" ? prev : "starting"));

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ camera. Hãy mở bằng Safari/Chrome qua đường dẫn https.");
      setPhase("error");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      const video = videoRef.current;
      if (generation !== generationRef.current || !video) {
        // Đã có lần mở camera mới hơn / modal đã đóng — tắt luồng thừa này.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (generation !== generationRef.current) return;
      setPhase((prev) => (prev === "preview" ? prev : "live"));
    } catch (err) {
      if (generation !== generationRef.current) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      stopStream();
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Bạn đã chặn quyền camera. Vào Cài đặt > Safari > Camera (hoặc biểu tượng aA trên thanh địa chỉ) để cho phép, rồi thử lại."
          : "Không mở được camera trên thiết bị này. Hãy dùng điện thoại có camera để kiểm kê."
      );
      setPhase("error");
    }
  }, [stopStream]);

  // Mở camera khi modal hiện, tắt hẳn camera khi modal đóng.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- khởi động camera (hệ thống bên ngoài) đúng 1 lần khi mở modal
    void startStream();
    return () => {
      // Bộ đếm (không phải DOM node) — cố ý đọc giá trị MỚI NHẤT lúc cleanup
      // để huỷ mọi lần mở camera còn đang chờ quyền.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationRef.current++;
      stopStream();
    };
  }, [startStream, stopStream]);

  // iPhone tắt/tạm dừng camera khi khoá màn hình hoặc chuyển app — quay lại
  // thì mở lại luồng, tránh chụp ra khung hình đen/đứng hình.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended" || track.muted) {
        void startStream();
      } else if (videoRef.current?.paused) {
        void videoRef.current.play().catch(() => startStream());
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [startStream]);

  // Thu hồi object URL ảnh xem trước.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  async function capture() {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!video || !video.videoWidth || !video.videoHeight || !track || track.readyState === "ended") {
      // Luồng camera đã chết (VD vừa khoá màn hình) — mở lại thay vì chụp
      // ra khung hình cũ.
      void startStream();
      return;
    }
    setError(null);

    const scale = Math.min(
      1,
      INVENTORY_PHOTO_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight)
    );
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // Watermark: dải nền tối phía dưới + thời gian chụp + thông tin thiết bị.
    const lines = [
      new Date().toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      ...watermarkLines,
    ];
    const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.032));
    const lineHeight = Math.round(fontSize * 1.35);
    const padding = Math.round(fontSize * 0.6);
    const barHeight = lines.length * lineHeight + padding * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, height - barHeight, width, barHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textBaseline = "top";
    lines.forEach((line, index) => {
      ctx.fillText(line, padding, height - barHeight + padding + index * lineHeight, width - padding * 2);
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", INVENTORY_PHOTO_JPEG_QUALITY)
    );
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) {
      setError("Không tạo được ảnh từ camera, vui lòng bấm Chụp lại.");
      return;
    }

    const file = new File([blob], `kiem-ke-${Date.now()}.jpg`, { type: "image/jpeg" });
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
    setPhase("preview");
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setError(null);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || track.readyState === "ended") {
      void startStream();
      return;
    }
    setPhase("live");
    if (videoRef.current?.paused) {
      void videoRef.current.play().catch(() => startStream());
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Chụp rõ tem S/N và thiết bị trong cùng 1 khung hình.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative aspect-[3/4] w-full bg-black sm:aspect-[4/3]">
          {/* video luôn hiển thị (ảnh xem trước phủ lên trên) — KHÔNG ẩn
              video vì Safari iOS có thể tự dừng video bị ẩn, bấm "Chụp lại"
              sẽ ra khung hình đứng. */}
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="h-full w-full object-contain"
          />

          {phase === "preview" && preview && (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước từ blob: URL cục bộ
            <img
              src={preview.url}
              alt="Ảnh vừa chụp"
              className="absolute inset-0 h-full w-full bg-black object-contain"
            />
          )}

          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
              <TriangleAlert size={32} />
              <p className="text-sm">{error}</p>
              <button
                type="button"
                onClick={() => void startStream()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>

        {(submitError || (phase !== "error" && error)) && (
          <div className="flex items-center gap-2 px-4 pt-3 text-sm font-medium text-rose-600">
            <TriangleAlert size={15} className="shrink-0" />
            {submitError || error}
          </div>
        )}

        <div className="flex gap-3 p-4">
          {phase === "preview" && preview ? (
            <>
              <button
                type="button"
                onClick={retake}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw size={18} />
                Chụp lại
              </button>
              <button
                type="button"
                onClick={() => onConfirm(preview.file)}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {submitting ? "Đang lưu..." : "Xác nhận"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void capture()}
              disabled={phase !== "live"}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Camera size={20} />
              Chụp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
