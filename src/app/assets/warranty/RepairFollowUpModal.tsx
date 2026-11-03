"use client";

import { useActionState, useState } from "react";
import { TriangleAlert, Wrench, CheckCircle2, Trash2, ClipboardList } from "lucide-react";
import {
  completeRepairAction,
  submitRepairFollowUpAction,
  type AssetActionState,
} from "../[id]/actions";

type Outcome = "PENDING_NOTE" | "FIXED" | "UNFIXABLE";

// Modal "bắt buộc" cập nhật cho 1 thiết bị sửa chữa/bảo hành đã quá hạn —
// mở từ nút đỏ ở trang /assets/warranty (và từ banner nhắc nhở trong
// AppLayout, cùng trỏ về trang này). Gộp lại đúng 3 tuỳ chọn có trong panel
// "Thao tác nhanh" ở trang chi tiết thiết bị (Sửa xong / Không sửa được) +
// thêm 1 tuỳ chọn thứ 3 — chỉ ghi lại hướng xử lý/lý do khi CHƯA xử lý dứt
// điểm được ngay (trường hợp phổ biến nhất nên để mặc định chọn sẵn). Dùng
// 2 useActionState riêng (thay vì 1 form) vì "Sửa xong"/"Không sửa được" đi
// qua completeRepairAction có sẵn (đổi hẳn trạng thái thiết bị), còn "Vẫn
// đang xử lý" đi qua submitRepairFollowUpAction mới (chỉ ghi log, giữ
// nguyên trạng thái REPAIR) — 2 action khác nhau, không gộp chung 1 form
// được.
export default function RepairFollowUpModal({
  assetId,
  assetTag,
  daysInRepair,
  returnTo,
}: {
  assetId: number;
  assetTag: string;
  daysInRepair: number;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("PENDING_NOTE");
  const [note, setNote] = useState("");

  const [followUpState, followUpAction, followUpPending] = useActionState<
    AssetActionState,
    FormData
  >(submitRepairFollowUpAction, null);

  const [completeState, completeAction, completePending] = useActionState<
    AssetActionState,
    FormData
  >(completeRepairAction, null);

  const isPending = followUpPending || completePending;
  const state = outcome === "PENDING_NOTE" ? followUpState : completeState;

  function selectOutcome(next: Outcome) {
    setOutcome(next);
    setNote("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
      >
        <TriangleAlert size={13} />
        Cập nhật hướng xử lý
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Cập nhật hướng xử lý — {assetTag}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Thiết bị đang sửa chữa/bảo hành đã quá {daysInRepair} ngày. Chọn 1
              hướng xử lý bên dưới.
            </p>

            <div className="mt-4 space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  outcome === "PENDING_NOTE"
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  checked={outcome === "PENDING_NOTE"}
                  onChange={() => selectOutcome("PENDING_NOTE")}
                  className="mt-1 h-4 w-4 accent-blue-600"
                />
                <span
                  className={`mt-0.5 ${outcome === "PENDING_NOTE" ? "text-blue-600" : "text-slate-400"}`}
                >
                  <ClipboardList size={16} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Gia hạn sửa chữa
                  </span>
                  <span className="block text-xs text-slate-500">
                    Chưa xong ngay được — bắt buộc nêu rõ lý do/hướng xử lý, hệ
                    thống gia hạn thêm 14 ngày rồi mới nhắc lại nếu vẫn còn
                    quá hạn
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  outcome === "FIXED"
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  checked={outcome === "FIXED"}
                  onChange={() => selectOutcome("FIXED")}
                  className="mt-1 h-4 w-4 accent-emerald-600"
                />
                <span
                  className={`mt-0.5 ${outcome === "FIXED" ? "text-emerald-600" : "text-slate-400"}`}
                >
                  <CheckCircle2 size={16} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Sửa xong
                  </span>
                  <span className="block text-xs text-slate-500">
                    Đưa thiết bị về Trong kho, sẵn sàng cấp phát lại
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  outcome === "UNFIXABLE"
                    ? "border-rose-400 bg-rose-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  checked={outcome === "UNFIXABLE"}
                  onChange={() => selectOutcome("UNFIXABLE")}
                  className="mt-1 h-4 w-4 accent-rose-600"
                />
                <span
                  className={`mt-0.5 ${outcome === "UNFIXABLE" ? "text-rose-600" : "text-slate-400"}`}
                >
                  <Trash2 size={16} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Không sửa được
                  </span>
                  <span className="block text-xs text-slate-500">
                    Chuyển thẳng sang Chờ thanh lý, không quay lại Trong kho
                  </span>
                </span>
              </label>
            </div>

            {outcome === "PENDING_NOTE" ? (
              <form action={followUpAction} className="mt-4 space-y-3">
                <input type="hidden" name="assetId" value={assetId} />
                <input type="hidden" name="returnTo" value={returnTo ?? ""} />

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Lý do / hướng xử lý <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    name="note"
                    required
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Đã gửi hãng, chờ báo giá linh kiện thay thế, dự kiến xong tuần sau..."
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    rows={3}
                  />
                </div>

                {state?.error && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    <TriangleAlert size={15} className="shrink-0" />
                    {state.error}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Đang lưu..." : "Gia hạn sửa chữa"}
                  </button>
                </div>
              </form>
            ) : (
              <form action={completeAction} className="mt-4 space-y-3">
                <input type="hidden" name="assetId" value={assetId} />
                <input type="hidden" name="outcome" value={outcome} />
                <input type="hidden" name="returnTo" value={returnTo ?? ""} />

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    {outcome === "UNFIXABLE" ? (
                      <>
                        Lý do không sửa được <span className="text-rose-500">*</span>
                      </>
                    ) : (
                      "Ghi chú (không bắt buộc)"
                    )}
                  </label>
                  <textarea
                    name="note"
                    required={outcome === "UNFIXABLE"}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      outcome === "UNFIXABLE"
                        ? "VD: Hỏng mainboard, không còn linh kiện thay thế..."
                        : "VD: Đã thay pin mới"
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    rows={2}
                  />
                </div>

                {state?.error && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    <TriangleAlert size={15} className="shrink-0" />
                    {state.error}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      outcome === "FIXED" ? "bg-emerald-600" : "bg-rose-600"
                    }`}
                  >
                    <Wrench size={15} />
                    {isPending
                      ? "Đang xử lý..."
                      : outcome === "FIXED"
                        ? "Hoàn tất sửa chữa"
                        : "Chuyển sang Chờ thanh lý"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
