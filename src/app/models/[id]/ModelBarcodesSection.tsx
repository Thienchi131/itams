"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, ScanBarcode, Trash2, TriangleAlert, CheckCircle2 } from "lucide-react";
import ProductBarcodeScannerModal, {
  type BarcodeScanFeedback,
} from "../../components/ProductBarcodeScannerModal";
import {
  addModelBarcodeAction,
  removeModelBarcodeAction,
  type ModelBarcodeItem,
} from "../barcode-actions";
import { formatModelBarcode } from "@/modules/asset/model-barcode";

// Mục "Mã UPC/EAN trên hộp" ở trang Sửa Model (chỉ Admin vào được trang
// này). Gắn bằng cách quét camera hoặc gõ tay; 1 model có nhiều mã.
export default function ModelBarcodesSection({
  modelId,
  initialBarcodes,
}: {
  modelId: number;
  initialBarcodes: ModelBarcodeItem[];
}) {
  const [barcodes, setBarcodes] = useState(initialBarcodes);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<number | null>(null);

  async function add(raw: string): Promise<BarcodeScanFeedback> {
    const res = await addModelBarcodeAction(modelId, raw);
    if (!res.ok) return { tone: "error", text: res.error };
    const shown = formatModelBarcode(res.barcode.code);
    if (res.alreadyOnThisModel) return { tone: "warn", text: `Mã ${shown} đã gắn với model này rồi.` };
    setBarcodes((prev) => [...prev, res.barcode]);
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

  function remove(id: number) {
    setRemovingId(id);
    startTransition(async () => {
      await removeModelBarcodeAction(id);
      setBarcodes((prev) => prev.filter((b) => b.id !== id));
      setRemovingId(null);
    });
  }

  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Mã UPC/EAN trên hộp</h3>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setScanning(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <ScanBarcode size={16} />
          Quét mã trên hộp
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Khi nhập kho máy mới nguyên hộp, IT quét mã này để tự chọn đúng model, không phải tìm
        hay tạo model mới. Một model có thể có nhiều mã (khác màu, khác thị trường).
      </p>

      {barcodes.length === 0 ? (
        <p className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-400">Chưa gắn mã nào.</p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {barcodes.map((b) => (
            <span
              key={b.id}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 font-mono text-sm font-semibold text-slate-700"
            >
              {formatModelBarcode(b.code)}
              <button
                type="button"
                onClick={() => remove(b.id)}
                disabled={pending}
                aria-label={`Xoá mã ${formatModelBarcode(b.code)}`}
                className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                {removingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
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
          placeholder="Hoặc gõ mã UPC/EAN (12–13 số)"
          className="w-full max-w-xs rounded-lg border px-4 py-2.5 font-mono text-sm"
        />
        <button
          type="button"
          onClick={submitManual}
          disabled={pending || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          {pending && removingId === null ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
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

      {scanning && (
        <ProductBarcodeScannerModal
          title="Gắn mã vào model này"
          hint="Quét mã UPC/EAN trên hộp — mỗi mã đọc được sẽ gắn ngay vào model này. Có thể quét tiếp hộp khác màu/khác thị trường."
          onDetected={add}
          onClose={() => setScanning(false)}
        />
      )}
    </section>
  );
}
