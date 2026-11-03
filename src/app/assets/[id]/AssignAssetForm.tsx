"use client";

import { useActionState, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import EmployeeSelect from "@/app/components/EmployeeSelect";
import { assignAssetAction, type AssetActionState } from "./actions";

type HeldAsset = {
  id: number;
  assetTag: string;
  serialNumber: string;
  model: { brand: string; modelName: string };
};

type Employee = {
  id: number;
  employeeCode: string;
  fullName: string;
  team?: { name: string } | null;
  // Thiết bị nhân viên đang giữ — chỉ dùng để hiện picker chọn máy đổi khi
  // Loại cấp phát = "Cấp đổi thiết bị" (EXCHANGE). Nguồn từ getEmployees()
  // (đã include assets kèm model từ employee.service.ts).
  assets: HeldAsset[];
};

type Accessory = { name: string; quantity: number };

type AssignmentType = "PERMANENT" | "LOAN" | "WARRANTY_HOLD" | "EXCHANGE";

// Nhãn + mô tả hạn cảnh báo cho từng loại — giữ đồng bộ với
// ASSIGNMENT_TYPE_LABEL/ASSIGNMENT_WARNING_DAYS trong asset.helpers.ts (phía
// server không import được từ client component nên khai báo lại ở đây, chỉ
// dùng để hiển thị — validate thật vẫn nằm ở assignAssetAction).
const ASSIGNMENT_TYPE_OPTIONS: {
  value: AssignmentType;
  label: string;
  hint: string;
}[] = [
  {
    value: "PERMANENT",
    label: "Cấp nhân viên mới",
    hint: "Không có hạn — thiết bị chính thức của nhân viên này.",
  },
  {
    value: "LOAN",
    label: "Cấp mượn",
    hint: "Cảnh báo sau 60 ngày nếu chưa thu hồi lại.",
  },
  {
    value: "WARRANTY_HOLD",
    label: "Cấp tạm chờ bảo hành",
    hint: "Cảnh báo sau 30 ngày nếu chưa thu hồi lại.",
  },
  {
    value: "EXCHANGE",
    label: "Cấp đổi thiết bị",
    hint: "Thu hồi ngay 1 thiết bị nhân viên đang giữ để đổi lấy máy này — không có hạn.",
  },
];

function hasAccessory(accessories: Accessory[], keyword: string) {
  return accessories.some((item) =>
    item.name.toLowerCase().includes(keyword.toLowerCase())
  );
}

export default function AssignAssetForm({
  assetId,
  employees,
  accessories = [],
  returnTo,
}: {
  assetId: number;
  employees: Employee[];
  accessories?: Accessory[];
  returnTo?: string;
}) {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addAdapter, setAddAdapter] = useState(false);
  const [addCable, setAddCable] = useState(false);
  const [assignmentType, setAssignmentType] = useState<AssignmentType | "">("");
  const [assignmentTypeError, setAssignmentTypeError] = useState(false);
  const [exchangeAssetId, setExchangeAssetId] = useState("");
  const [exchangeAssetIdError, setExchangeAssetIdError] = useState(false);
  const [note, setNote] = useState("");

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, isPending] = useActionState<AssetActionState, FormData>(
    assignAssetAction,
    null
  );

  // Tình trạng phụ kiện hiện đang ghi nhận trên thiết bị (trong kho) — nếu
  // thiếu, cho phép IT tick "bổ sung" ngay lúc bàn giao thay vì phải vào
  // sửa thiết bị riêng sau đó.
  const currentAdapter = hasAccessory(accessories, "adapter");
  const currentCable =
    hasAccessory(accessories, "cáp") ||
    hasAccessory(accessories, "cap") ||
    hasAccessory(accessories, "cable");

  // Trước đây bấm "Bàn giao" khi chưa chọn nhân viên (hoặc gõ 1 cái tên
  // không có trong danh sách gợi ý) sẽ submit thẳng xuống server với
  // employeeId rỗng, server action crash → Next.js hiện trang lỗi trắng
  // "This page couldn't load". Giờ chặn ngay ở client, không cho mở modal
  // xác nhận nếu chưa có lựa chọn hợp lệ.
  function handleBanGiaoClick() {
    if (!selected) {
      setError("Vui lòng chọn nhân viên trước khi bàn giao.");
      return;
    }

    setError(null);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!assignmentType) {
      setAssignmentTypeError(true);
      return;
    }

    if (assignmentType === "EXCHANGE" && !exchangeAssetId) {
      setExchangeAssetIdError(true);
      return;
    }

    setAssignmentTypeError(false);
    setExchangeAssetIdError(false);
    setConfirmOpen(false);
    submitButtonRef.current?.click();
  }

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />
      <input type="hidden" name="assignmentType" value={assignmentType} />
      <input type="hidden" name="exchangeAssetId" value={exchangeAssetId} />
      <input type="hidden" name="note" value={note} />

      <EmployeeSelect
        employees={employees}
        hasError={Boolean(error)}
        onSelectedChange={(employee) => {
          // EmployeeSelect dùng type Employee CỦA RIÊNG NÓ (không có field
          // "assets") — cast lại đúng type rộng hơn ở đây vì object truyền
          // vào thực chất vẫn là phần tử gốc của mảng `employees` (đã có đủ
          // assets từ getEmployees()), chỉ là type khai báo ở EmployeeSelect
          // hẹp hơn.
          const selectedEmployee = employee as Employee | null;
          setSelected(selectedEmployee);
          if (selectedEmployee) setError(null);
          // Đổi nhân viên nhận — danh sách "thiết bị đang giữ" đã khác, xoá
          // lựa chọn máy đổi cũ (nếu có) tránh gửi kèm asset của người khác.
          setExchangeAssetId("");
          setExchangeAssetIdError(false);
        }}
      />

      {(error || state?.error) && (
        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-600">
          <TriangleAlert size={15} className="shrink-0" />
          {error || state?.error}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleBanGiaoClick}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Bàn giao
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900">
              Xác nhận bàn giao
            </h2>

            <p className="mt-3 text-slate-600">
              Bàn giao thiết bị này cho{" "}
              <span className="font-semibold text-slate-900">
                {selected?.fullName}
              </span>
              ?
            </p>

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-500">
                Loại cấp phát
              </p>

              <select
                value={assignmentType}
                onChange={(e) => {
                  const next = e.target.value as AssignmentType;
                  setAssignmentType(next);
                  setAssignmentTypeError(false);
                  // Đổi khỏi EXCHANGE (hoặc đổi lại) — xoá lựa chọn máy đổi cũ,
                  // tránh gửi kèm exchangeAssetId không còn liên quan tới loại
                  // cấp phát mới chọn.
                  if (next !== "EXCHANGE") {
                    setExchangeAssetId("");
                    setExchangeAssetIdError(false);
                  }
                }}
                className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${
                  assignmentTypeError
                    ? "border-rose-300 bg-rose-50"
                    : "border-slate-200 focus:border-blue-400"
                }`}
              >
                <option value="">-- Chọn loại cấp phát --</option>
                {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {assignmentType && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {
                    ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === assignmentType)
                      ?.hint
                  }
                </p>
              )}

              {assignmentTypeError && (
                <div className="mt-1.5 flex items-center gap-2 text-xs font-medium text-rose-600">
                  <TriangleAlert size={13} className="shrink-0" />
                  Vui lòng chọn loại cấp phát.
                </div>
              )}

              {assignmentType === "EXCHANGE" && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-500">
                    Thiết bị cần thu hồi để đổi
                  </p>

                  {selected && selected.assets.length === 0 ? (
                    <p className="mt-2 text-xs font-medium text-rose-600">
                      {selected.fullName} hiện chưa giữ thiết bị nào để đổi.
                    </p>
                  ) : (
                    <select
                      value={exchangeAssetId}
                      onChange={(e) => {
                        setExchangeAssetId(e.target.value);
                        setExchangeAssetIdError(false);
                      }}
                      className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${
                        exchangeAssetIdError
                          ? "border-rose-300 bg-rose-50"
                          : "border-slate-200 focus:border-blue-400"
                      }`}
                    >
                      <option value="">-- Chọn thiết bị đang giữ --</option>
                      {selected?.assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assetTag} — {a.model.brand} {a.model.modelName} (
                          {a.serialNumber})
                        </option>
                      ))}
                    </select>
                  )}

                  {exchangeAssetIdError && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <TriangleAlert size={13} className="shrink-0" />
                      Vui lòng chọn thiết bị cần thu hồi để đổi.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-500">
                Phụ kiện đi kèm
              </p>

              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">Adapter</span>
                  {currentAdapter ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      Có sẵn
                    </span>
                  ) : (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        name="addAdapter"
                        checked={addAdapter}
                        onChange={(e) => setAddAdapter(e.target.checked)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      Bổ sung Adapter khi bàn giao
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">Dây sạc</span>
                  {currentCable ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      Có sẵn
                    </span>
                  ) : (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        name="addCable"
                        checked={addCable}
                        onChange={(e) => setAddCable(e.target.checked)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      Bổ sung dây sạc khi bàn giao
                    </label>
                  )}
                </div>
              </div>

              {(!currentAdapter || !currentCable) && (
                <p className="mt-2 text-xs text-slate-400">
                  Kho hiện không ghi nhận đủ phụ kiện trên — tick để bổ sung
                  kèm theo lúc bàn giao, hoặc bỏ qua nếu giao máy trần.
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-slate-500">Ghi chú</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                rows={2}
                placeholder="Nhập ghi chú nếu có (VD: giao kèm túi đựng, nhân viên yêu cầu giao gấp...)"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-300 px-6 py-2.5 font-semibold transition hover:bg-slate-100"
              >
                Huỷ
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button ref={submitButtonRef} type="submit" className="hidden" />
    </form>
  );
}
