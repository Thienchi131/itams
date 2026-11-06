"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanLine, TriangleAlert, X } from "lucide-react";
import {
  normalizeScannedSerial,
  SCANNED_SERIAL_REJECT_LABEL,
} from "@/modules/asset/scanned-serial";

type Controls = { stop: () => void };

type ScannedItem = {
  serial: string;
  // checking: đang kiểm tra trùng với hệ thống; ok: đã thêm; in_system: đã
  // thêm vào phiếu nhưng serial này ĐÃ CÓ trong hệ thống (phiếu sẽ bị chặn
  // lúc Lưu như khi gõ tay — IT xoá ô đó đi).
  status: "checking" | "ok" | "in_system";
};

type Feedback = { tone: "ok" | "warn" | "error"; text: string } | null;

// Quét liên tục mã vạch (Code 128/39/93, ITF...) hoặc QR/DataMatrix in trên
// thân máy/hộp máy bằng camera điện thoại để điền Serial vào phiếu nhập kho —
// mỗi mã đọc được tự thêm vào 1 ô Serial, quét xong máy này đưa sang máy kế
// tiếp, không cần bấm gì thêm. Bỏ qua mã sản phẩm EAN/UPC (mã hàng hoá trên
// hộp, không phải serial). Thư viện ZXing chạy trong trình duyệt, không gửi
// hình ảnh đi đâu. Camera chỉ chạy trên HTTPS (hoặc localhost).
export default function SerialScannerModal({
  title,
  maxLength,
  defaultStripApplePrefix,
  existingInForm,
  onAdd,
  checkInSystem,
  onClose,
}: {
  title: string;
  maxLength: number;
  // Model đang chọn là Apple -> mặc định bỏ chữ "S" đầu mã vạch trên hộp.
  defaultStripApplePrefix: boolean;
  // Serial (viết thường) đã có trong phiếu lúc mở — "line" = ngay dòng này,
  // "other" = dòng model khác.
  existingInForm: Map<string, "line" | "other">;
  onAdd: (serial: string) => void;
  // Trả về các serial ĐÃ TỒN TẠI trong hệ thống.
  checkInSystem: (serials: string[]) => Promise<string[]>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const seenRef = useRef<Map<string, "line" | "other">>(new Map(existingInForm));
  const lastRawRef = useRef<{ raw: string; at: number }>({ raw: "", at: 0 });
  const stripRef = useRef(defaultStripApplePrefix);

  const [phase, setPhase] = useState<"starting" | "live" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stripApple, setStripApple] = useState(defaultStripApplePrefix);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [flash, setFlash] = useState<"ok" | "warn" | null>(null);

  useEffect(() => {
    stripRef.current = stripApple;
  }, [stripApple]);

  const signal = useCallback((tone: "ok" | "warn") => {
    setFlash(tone);
    window.setTimeout(() => setFlash(null), 350);
    if (navigator.vibrate) navigator.vibrate(tone === "ok" ? 60 : [40, 60, 40]);
  }, []);

  const handleDecoded = useCallback(
    (raw: string) => {
      // Camera đọc lại cùng 1 mã liên tục khi còn chĩa vào — bỏ qua mã vừa
      // xử lý trong 2.5 giây.
      const now = Date.now();
      if (lastRawRef.current.raw === raw && now - lastRawRef.current.at < 2500) return;
      lastRawRef.current = { raw, at: now };

      const result = normalizeScannedSerial(raw, {
        maxLength,
        stripAppleBoxPrefix: stripRef.current,
      });

      if (!result.ok) {
        setFeedback({ tone: "error", text: `${SCANNED_SERIAL_REJECT_LABEL[result.reason]}: "${raw.slice(0, 40)}"` });
        signal("warn");
        return;
      }

      const key = result.serial.toLowerCase();
      const seen = seenRef.current.get(key);
      if (seen) {
        setFeedback({
          tone: "warn",
          text:
            seen === "other"
              ? `${result.serial} đã có ở dòng Model khác trong phiếu — bỏ qua.`
              : `${result.serial} đã có trong danh sách — bỏ qua.`,
        });
        signal("warn");
        return;
      }

      seenRef.current.set(key, "line");
      onAdd(result.serial);
      setItems((prev) => [{ serial: result.serial, status: "checking" }, ...prev]);
      setFeedback({ tone: "ok", text: `Đã thêm ${result.serial}` });
      signal("ok");

      checkInSystem([result.serial])
        .then((existing) => {
          const inSystem = existing.some((s) => s.toLowerCase() === key);
          setItems((prev) =>
            prev.map((item) =>
              item.serial === result.serial
                ? { ...item, status: inSystem ? "in_system" : "ok" }
                : item
            )
          );
          if (inSystem) {
            setFeedback({
              tone: "warn",
              text: `${result.serial} ĐÃ CÓ trong hệ thống — kiểm tra lại máy này.`,
            });
            signal("warn");
          }
        })
        .catch(() => {
          setItems((prev) =>
            prev.map((item) => (item.serial === result.serial ? { ...item, status: "ok" } : item))
          );
        });
    },
    [maxLength, onAdd, checkInSystem, signal]
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

        // Chỉ các định dạng hay dùng cho SERIAL — cố tình KHÔNG có EAN/UPC
        // (mã sản phẩm in trên hộp, mọi máy cùng model đều giống nhau).
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.PDF_417,
        ]);

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
            if (result) handleDecodedRef.current(result.getText());
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
            : "Không mở được camera trên thiết bị này. Hãy dùng điện thoại có camera, hoặc nhập Serial bằng tay."
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

  const addedCount = items.length;
  const inSystemCount = items.filter((item) => item.status === "in_system").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <ScanLine size={18} className="text-blue-600" />
              Quét Serial
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
            Đưa mã vạch / QR Serial vào khung — đọc được là tự thêm, cứ quét lần lượt từng máy.
            Mã sản phẩm EAN/UPC trên hộp sẽ được bỏ qua.
          </p>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={stripApple}
              onChange={(e) => setStripApple(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Bỏ chữ “S” đầu mã (mã vạch Serial trên hộp Apple)
          </label>

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
              <span className="break-all">{feedback.text}</span>
            </div>
          )}

          {addedCount > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500">
                Đã quét {addedCount} serial
                {inSystemCount > 0 && (
                  <span className="text-rose-600"> · {inSystemCount} đã có trong hệ thống</span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <span
                    key={item.serial}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                      item.status === "in_system"
                        ? "bg-rose-100 text-rose-700"
                        : item.status === "checking"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.status === "checking" && <Loader2 size={11} className="animate-spin" />}
                    {item.serial}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700"
          >
            {addedCount > 0 ? `Xong (${addedCount} serial)` : "Đóng"}
          </button>
        </div>
      </div>
    </div>
  );
}
