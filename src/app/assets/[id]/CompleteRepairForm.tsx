"use client";

import { useActionState, useState } from "react";
import { TriangleAlert, Wrench, CheckCircle2, Trash2 } from "lucide-react";
import { completeRepairAction, type AssetActionState } from "./actions";
import ConfirmActionButton from "../../components/ConfirmActionButton";

type Outcome = "FIXED" | "UNFIXABLE";

// 2 hướng kết quả khi xử lý xong 1 thiết bị đang Bảo trì (REPAIR):
//   - Sửa xong: về Trong kho như trước đây.
//   - Không sửa được: chuyển THẲNG sang Chờ thanh lý — trước đây phải Hoàn
//     tất về Trong kho rồi mới gửi thanh lý tiếp (2 bước không cần thiết,
//     máy "ghé" qua Trong kho 1 nhịp dù không dùng được nữa).
export default function CompleteRepairForm({
  assetId,
  returnTo,
}: {
  assetId: number;
  returnTo?: string;
}) {
  const [state, formAction] = useActionState<AssetActionState, FormData>(
    completeRepairAction,
    null
  );
  const [outcome, setOutcome] = useState<Outcome>("FIXED");
  const [note, setNote] = useState("");

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />

      <div className="space-y-2">
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
            onChange={() => setOutcome("FIXED")}
            className="mt-1 h-4 w-4 accent-emerald-600"
          />
          <span className={`mt-0.5 ${outcome === "FIXED" ? "text-emerald-600" : "text-slate-400"}`}>
            <CheckCircle2 size={16} />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-800">Sửa xong</span>
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
            onChange={() => setOutcome("UNFIXABLE")}
            className="mt-1 h-4 w-4 accent-rose-600"
          />
          <span className={`mt-0.5 ${outcome === "UNFIXABLE" ? "text-rose-600" : "text-slate-400"}`}>
            <Trash2 size={16} />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-800">Không sửa được</span>
            <span className="block text-xs text-slate-500">
              Chuyển thẳng sang Chờ thanh lý, không quay lại Trong kho
            </span>
          </span>
        </label>
      </div>

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

      {outcome === "FIXED" ? (
        <ConfirmActionButton
          label="Hoàn tất sửa chữa"
          confirmTitle="Xác nhận đã sửa xong?"
          confirmMessage="Thiết bị sẽ chuyển về trạng thái Trong kho, sẵn sàng cấp phát lại."
          confirmLabel="Hoàn tất"
          color="amber"
          icon={<Wrench size={15} />}
        />
      ) : (
        <ConfirmActionButton
          label="Chuyển sang Chờ thanh lý"
          confirmTitle="Xác nhận không sửa được?"
          confirmMessage="Thiết bị sẽ chuyển THẲNG sang Chờ thanh lý (không quay lại Trong kho). Không thể hoàn tác."
          confirmLabel="Chuyển thanh lý"
          color="rose"
          icon={<Trash2 size={15} />}
        />
      )}
    </form>
  );
}
