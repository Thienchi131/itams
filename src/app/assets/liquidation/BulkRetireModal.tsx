"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ListPlus,
  ScanSearch,
  Trash2,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import {
  bulkRetireAction,
  previewBulkRetireAction,
  type BulkRetireActionState,
  type BulkRetirePreviewRow,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "Trong kho",
  REPAIR: "Bảo trì",
  ASSIGNED: "Đã cấp phát",
  RETIRED: "Chờ thanh lý",
  LOST: "Thất lạc",
  IN_TRANSIT: "Đang luân chuyển",
};

export default function BulkRetireModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const [codes, setCodes] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<BulkRetirePreviewRow[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isChecking, startChecking] = useTransition();


  const validRows = useMemo(() => rows.filter((r) => r.ok), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => !r.ok), [rows]);

  const codeCount = useMemo(
    () => new Set(codes.split(/[\s,;]+/).filter(Boolean).map((c) => c.toUpperCase())).size,
    [codes]
  );

  const reset = () => {
    setStep("input");
    setCodes("");
    setReason("");
    setRows([]);
    setPreviewError(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  // Chuyển thành công → đóng modal ngay trong action (không dùng effect);
  // trang tự làm mới nhờ revalidatePath.
  const [state, formAction, isPending] = useActionState<BulkRetireActionState, FormData>(
    async (prev, formData) => {
      const result = await bulkRetireAction(prev, formData);
      if (result && "success" in result) {
        setOpen(false);
        reset();
      }
      return result;
    },
    null
  );

  const handleCheck = () => {
    setPreviewError(null);
    startChecking(async () => {
      const result = await previewBulkRetireAction(codes);
      if ("error" in result) {
        setPreviewError(result.error);
        return;
      }
      setRows(result.rows);
      setStep("preview");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-amber-700"
      >
        <ListPlus size={18} />
        Thêm thiết bị
      </button>

      {state && "success" in state && !open && (
        <span className="text-sm font-medium text-emerald-700">
          Đã chuyển {state.count} thiết bị vào Chờ thanh lý
          {state.skipped > 0 ? ` (bỏ qua ${state.skipped} máy đã đổi trạng thái)` : ""}.
        </span>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Thêm hàng loạt vào Chờ thanh lý
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {step === "input"
                    ? "Dán danh sách Asset Tag hoặc Serial — mỗi dòng 1 mã, có thể copy nguyên cột từ Excel."
                    : "Kiểm tra lại danh sách trước khi xác nhận."}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {step === "input" && (
              <div className="overflow-y-auto p-6">
                <label className="block text-sm font-semibold text-slate-700">
                  Asset Tag / Serial <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={codes}
                  onChange={(e) => setCodes(e.target.value)}
                  placeholder={"VD:\nLT-000123\nLT-000124\nC02XK1ABJG5H"}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  rows={10}
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500">
                  {codeCount} mã · tối đa 1000 mã mỗi lần. Hỗ trợ ngăn cách bằng xuống dòng, dấu phẩy, dấu chấm phẩy hoặc tab.
                </p>

                <label className="mt-5 block text-sm font-semibold text-slate-700">
                  Lý do thanh lý (áp dụng cho cả lô) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Hết vòng đời sử dụng, hư hỏng không sửa được..."
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  rows={2}
                />

                {previewError && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    <TriangleAlert size={15} className="shrink-0" />
                    {previewError}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={close} className="rounded-lg border px-4 py-2 text-sm">
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={handleCheck}
                    disabled={isChecking || codeCount === 0 || !reason.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ScanSearch size={16} />
                    {isChecking ? "Đang kiểm tra..." : "Kiểm tra danh sách"}
                  </button>
                </div>
              </div>
            )}

            {step === "preview" && (
              <form action={formAction} className="flex min-h-0 flex-1 flex-col">
                <input type="hidden" name="reason" value={reason} />
                <input type="hidden" name="assetIds" value={validRows.map((r) => r.asset!.id).join(",")} />

                <div className="grid grid-cols-2 gap-3 px-6 pt-5">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 size={18} />
                    {validRows.length} hợp lệ
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    <XCircle size={18} />
                    {invalidRows.length} bị loại
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-3 text-left">Mã nhập</th>
                        <th className="p-3 text-left">Thiết bị</th>
                        <th className="p-3 text-left">Kho</th>
                        <th className="p-3 text-left">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...invalidRows, ...validRows].map((row) => (
                        <tr key={row.code} className="border-t border-slate-100 align-top">
                          <td className="p-3 font-mono text-xs text-slate-700">{row.code}</td>
                          <td className="p-3">
                            {row.asset ? (
                              <>
                                <div className="font-semibold text-slate-900">{row.asset.assetTag}</div>
                                <div className="text-xs text-slate-500">
                                  {row.asset.model} · SN {row.asset.serialNumber}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-slate-600">{row.asset?.warehouse ?? "-"}</td>
                          <td className="p-3">
                            {row.ok ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={14} />
                                Hợp lệ ({STATUS_LABEL[row.asset!.status] ?? row.asset!.status})
                              </span>
                            ) : (
                              <span className="inline-flex items-start gap-1 text-xs font-semibold text-rose-700">
                                <XCircle size={14} className="mt-px shrink-0" />
                                {row.reason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-100 p-6">
                  <p className="mb-3 text-sm text-slate-600">
                    <span className="font-semibold">Lý do:</span> {reason}
                  </p>

                  {state && "error" in state && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                      <TriangleAlert size={15} className="shrink-0" />
                      {state.error}
                    </div>
                  )}

                  <div className="flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("input")}
                      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
                    >
                      <ArrowLeft size={16} />
                      Sửa danh sách
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || validRows.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      {isPending
                        ? "Đang xử lý..."
                        : `Chuyển ${validRows.length} thiết bị vào Chờ thanh lý`}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
