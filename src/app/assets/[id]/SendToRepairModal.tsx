"use client";

import { useActionState, useState } from "react";
import { TriangleAlert, Wrench, ShieldCheck, Trash2 } from "lucide-react";
import { sendToRepairAction, type AssetActionState } from "./actions";

type Category = "WARRANTY" | "DAMAGED" | "RETIRE";

const CATEGORIES: {
  value: Category;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "WARRANTY",
    label: "Gửi bảo hành",
    desc: "Tạm thời — gửi hãng/nhà cung cấp bảo hành, sẽ quay lại Trong kho",
    icon: <ShieldCheck size={16} />,
  },
  {
    value: "DAMAGED",
    label: "Hư hỏng",
    desc: "Tạm thời — gửi sửa chữa nội bộ, sẽ quay lại Trong kho",
    icon: <Wrench size={16} />,
  },
  {
    value: "RETIRE",
    label: "Chờ thanh lý",
    desc: "Vĩnh viễn — không còn dùng được nữa, đưa ra khỏi kho hoạt động",
    icon: <Trash2 size={16} />,
  },
];

export default function SendToRepairModal({
  assetId,
  returnTo,
}: {
  assetId: number;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("DAMAGED");
  const [reason, setReason] = useState("");
  const [state, formAction, isPending] = useActionState<
    AssetActionState,
    FormData
  >(sendToRepairAction, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100"
      >
        <Wrench size={16} />
        Gửi bảo hành / Hư hỏng / Thanh lý
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">
              Chuyển thiết bị ra khỏi kho hoạt động
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Thiết bị sẽ không còn tính vào tồn kho khả dụng. Chọn đúng
              hướng xử lý để hệ thống theo dõi ở đúng nơi.
            </p>

            <form action={formAction} className="mt-5">
              <input type="hidden" name="assetId" value={assetId} />
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="returnTo" value={returnTo ?? ""} />

              <div className="space-y-2">
                {CATEGORIES.map((c) => (
                  <label
                    key={c.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      category === c.value
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="categoryRadio"
                      checked={category === c.value}
                      onChange={() => setCategory(c.value)}
                      className="mt-1 h-4 w-4 accent-amber-600"
                    />
                    <span
                      className={`mt-0.5 ${
                        category === c.value ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {c.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-800">
                        {c.label}
                      </span>
                      <span className="block text-xs text-slate-500">{c.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Lý do / mô tả chi tiết <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Vỡ màn hình, không lên nguồn, hết vòng đời sử dụng..."
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                rows={3}
              />

              {state?.error && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  <TriangleAlert size={15} className="shrink-0" />
                  {state.error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Huỷ
                </button>

                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wrench size={16} />
                  {isPending ? "Đang xử lý..." : "Xác nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
