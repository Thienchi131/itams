"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanBarcode, TriangleAlert, X } from "lucide-react";
import {
  MODEL_BARCODE_REJECT_LABEL,
  normalizeModelBarcode,
  type BarcodeFormatHint,
} from "@/modules/asset/model-barcode";

type Controls = { stop: () => void };

export type BarcodeScanFeedback = {
  tone: "ok" | "warn" | "error";
  text: string;
  // true = xử lý xong, tự đóng camera sau giây lát.
  close?: boolean;
};

// Quét mã vạch SẢN PHẨM (UPC/EAN) in trên hộp máy mới bằng camera — khác
// SerialScannerModal (chỉ đọc mã Serial, bỏ qua UPC/EAN). Chỉ bật các định
// dạng UPC-A/UPC-E/EAN-13/EAN-8 nên chĩa vào hộp có nhiều mã vạch cũng chỉ
// đọc đúng mã sản phẩm. Mã đã chuẩn hoá (normalizeModelBarcode) được đưa cho
// onDetected xử lý (tra model / gắn vào model). ZXing chạy trong trình duyệt.
export default function ProductBarcodeScannerModal({
  title,
  hint,
  onDetected,
  onClose,
}: {
  title: string;
  hint?: string;
  onDetected: (code: string) => Promise<BarcodeScanFeedback> | BarcodeScanFeedback;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const lastRawRef = useRef<{ raw: string; at: number }>({ raw: "", at: 0 });
  const busyRef = useRef(false);
  const closedRef = useRef(false);

  const [phase, setPhase] = useState<"starting" | "live" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BarcodeScanFeedback | null>(null);
  const [flash, setFlash] = useState<"ok" | "warn" | null>(null);

  const signal = useCallback((tone: "ok" | "warn") => {
    setFlash(tone);
    window.setTimeout(() => setFlash(null), 350);
    if (navigator.vibrate) navigator.vibrate(tone === "ok" ? 60 : [40, 60, 40]);
  }, []);

  const handleDecoded = useCallback(
    async (raw: string, format: BarcodeFormatHint) => {
      if (busyRef.current || closedRef.current) return;
      const now = Date.now();
      if (lastRawRef.current.raw === raw && now - lastRawRef.current.at < 2500) return;
      lastRawRef.current = { raw, at: now };

      const result = normalizeModelBarcode(raw, format);
      if (!result.ok) {
        setFeedback({ tone: "error", text: `${MODEL_BARCODE_REJECT_LABEL[result.reason]}: "${raw.slice(0, 40)}"` });
        signal("warn");
        return;
      }

      busyRef.current = true;
      try {
        const res = await onDetected(result.code);
        setFeedback(res);
        signal(res.tone === "ok" ? "ok" : "warn");
        if (res.close) {
          closedRef.current = true;
          window.setTimeout(onClose, 700);
        }
      } catch {
        setFeedback({ tone: "error", text: "Có lỗi khi xử lý mã, thử lại." });
        signal("warn");
      } finally {
        busyRef.current = false;
      }
    },
    [onDetected, onClose, signal]
  );

  const handleDecodedRef = useRef(handleDecoded);
  useEffect(() => {
    handleDecodedRef.current = handleDecoded;
  }, [handleDecoded]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Trình duyệt không hỗ trợ camera. Hãy mở bằng Safari/Chrome qua đường dẫn https.");
        setPhase("error");
        return;
      }

      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
        ]);

        const formatName = (f: number): BarcodeFormatHint => {
          if (f === BarcodeFormat.UPC_A) return "UPC_A";
          if (f === BarcodeFormat.UPC_E) return "UPC_E";
          if (f === BarcodeFormat.EAN_13) return "EAN_13";
          if (f === BarcodeFormat.EAN_8) return "EAN_8";
          return null;
        };

        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          videoRef.current!,
          (result) => {
            if (result) void handleDecodedRef.current(result.getText(), formatName(result.getBarcodeFormat()));
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setPhase("live");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setCameraError(
          name === "NotAllowedError"
            ? "Bạn đã chặn quyền camera. Vào Cài đặt > Safari > Camera (hoặc biểu tượng aA trên thanh địa chỉ) để cho phép, rồi thử lại."
            : "Không mở được camera trên thiết bị này. Hãy dùng điện thoại có camera, hoặc gõ mã bằng tay."
        );
        setPhase("error");
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <ScanBarcode size={18} className="text-blue-600" />
              Quét mã UPC/EAN trên hộp
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`relative aspect-[4/3] w-full bg-black transition ${
            flash === "ok"
              ? "ring-4 ring-inset ring-emerald-400"
              : flash === "warn"
                ? "ring-4 ring-inset ring-amber-400"
                : ""
          }`}
        >
          <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover" />

          {phase === "live" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-5/6 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
            </div>
          )}

          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
              <TriangleAlert size={32} />
              <p className="text-sm">{cameraError}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <p className="text-xs text-slate-500">
            {hint ??
              "Đưa mã vạch sản phẩm (dãy 12–13 số, thường dưới chữ UPC/EAN) trên hộp vào khung. Mã Serial sẽ được bỏ qua."}
          </p>

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                feedback.tone === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : feedback.tone === "warn"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.tone === "ok" ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              )}
              <span className="break-words">{feedback.text}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
