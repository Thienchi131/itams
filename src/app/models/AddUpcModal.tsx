"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, ScanBarcode, TriangleAlert, X } from "lucide-react";
import ProductBarcodeScannerModal, {
  type BarcodeScanFeedback,
} from "../components/ProductBarcodeScannerModal";
import { addModelBarcodeAction } from "./barcode-actions";
import { formatModelBarcode } from "@/modules/asset/model-barcode";

// Thêm nhanh mã UPC/EAN cho 1 model ngay từ danh sách Model Library (không
// phải vào trang Sửa). Chỉ Admin — nút mở modal này chỉ hiện cho Admin, và
// addModelBarcodeAction tự chặn lại 1 lần nữa ở server.
export default function AddUpcModal({
  modelId,
  modelLabel,
  onClose,
}: {
  modelId: number;
  modelLabel: string;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();

  async function add(raw: string): Promise<BarcodeScanFeedback> {
    const res = await addModelBarcodeAction(modelId, raw);
    if (!res.ok) return { tone: "error", text: res.error };
    const shown = formatModelBarcode(res.barcode.code);
    if (res.alreadyOnThisModel) return { tone: "warn", text: `Mã ${shown} đã gắn với model này rồi.` };
    setAdded((prev) => [...prev, shown]);
    return { tone: "ok", text: `Đã gắn mã ${shown}.` };
  }

  function submitManual() {
    const raw = input.trim();
    if (!raw) return;
    startTransition(async () => {
      const res = await add(raw);
      setMessage({ tone: res.tone === "error" ? "error" : "ok", text: res.text });
      if (res.tone !== "error") setInput("");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ScanBarcode size={18} className="text-blue-600" />
              Thêm mã UPC
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">{modelLabel}</p>
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

        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setScanning(true);
          }}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
        >
          <ScanBarcode size={18} />
          Quét mã trên hộp
        </button>

        <div className="mt-3 flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          hoặc gõ tay
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitManual();
              }
            }}
            inputMode="numeric"
            placeholder="Mã UPC/EAN (12–13 số)"
            className="w-full rounded-lg border px-4 py-2.5 font-mono text-sm"
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={pending || !input.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Thêm
          </button>
        </div>

        {message && (
          <p
            className={`mt-3 flex items-start gap-2 text-sm font-medium ${
              message.tone === "ok" ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            {message.tone === "ok" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            )}
            {message.text}
          </p>
        )}

        {added.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500">Đã thêm trong lần này:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {added.map((code) => (
                <span
                  key={code}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-sm font-semibold text-slate-700"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-50"
        >
          Xong
        </button>

        {scanning && (
          <ProductBarcodeScannerModal
            title={`Gắn mã vào: ${modelLabel}`}
            hint="Quét mã UPC/EAN trên hộp — mỗi mã đọc được gắn ngay vào model này."
            onDetected={add}
            onClose={() => setScanning(false)}
          />
        )}
      </div>
    </div>
  );
}
