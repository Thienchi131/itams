"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Search, TriangleAlert, X } from "lucide-react";
import EmployeeSelect from "@/app/components/EmployeeSelect";
import {
  bulkReturnAssetsAction,
  bulkTransferAssetsAction,
  assignAdditionalAssetAction,
  type EmployeeActionState,
} from "./actions";
import ReturnWarehouseSelect from "@/app/components/ReturnWarehouseSelect";
import type { WarehouseOption } from "@/modules/warehouse/return-destination";

type AssetItem = {
  id: number;
  assetTag: string;
  serialNumber: string;
  model: { brand: string; modelName: string };
  warehouse: { code: string; name: string } | null;
  accessories: { name: string }[];
};

type AvailableAsset = {
  id: number;
  assetTag: string;
  serialNumber: string;
  model: { brand: string; modelName: string };
  warehouse: { code: string; name: string } | null;
};

type EmployeeOption = {
  id: number;
  employeeCode: string;
  fullName: string;
  team?: { name: string } | null;
};

type AssignmentType = "PERMANENT" | "LOAN" | "WARRANTY_HOLD" | "EXCHANGE";

// Cùng danh sách với AssignAssetForm.tsx (assets/[id]) — giữ đồng bộ với
// ASSIGNMENT_TYPE_LABEL/ASSIGNMENT_WARNING_DAYS ở asset.helpers.ts.
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
    hint: "Thu hồi ngay 1 thiết bị nhân viên đang giữ để đổi lấy máy này — chỉ chọn được 1 thiết bị mới mỗi lần, không có hạn.",
  },
];

function hasAccessory(accessories: { name: string }[], keyword: string) {
  return accessories.some((item) =>
    item.name.toLowerCase().includes(keyword.toLowerCase())
  );
}

export default function EmployeeAssetsPanel({
  employeeId,
  assets,
  availableAssets,
  employees,
  returnWarehouseOptions = [],
  defaultReturnWarehouseId = null,
}: {
  employeeId: number;
  assets: AssetItem[];
  availableAssets: AvailableAsset[];
  employees: EmployeeOption[];
  returnWarehouseOptions?: WarehouseOption[];
  defaultReturnWarehouseId?: number | null;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modal, setModal] = useState<"return" | "transfer" | "assign" | null>(
    null
  );

  const selectedAssets = assets.filter((asset) =>
    selectedIds.includes(asset.id)
  );

  function toggleOne(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.length === assets.length ? [] : assets.map((a) => a.id)
    );
  }

  const otherEmployees = employees.filter((e) => e.id !== employeeId);

  return (
    <>
      <section className="overflow-hidden rounded-2xl lg:col-span-2 border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Thiết bị đang giữ ({assets.length})
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách thiết bị đang được gán cho nhân viên này
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setModal("return")}
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Thu hồi thiết bị{selectedIds.length > 0 && ` (${selectedIds.length})`}
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setModal("transfer")}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Chuyển thiết bị{selectedIds.length > 0 && ` (${selectedIds.length})`}
            </button>

            <button
              type="button"
              onClick={() => setModal("assign")}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white hover:shadow-md"
            >
              + Cấp thiết bị
            </button>
          </div>
        </div>

        {/* Vài nhân viên giữ >100 thiết bị — bảng dài vô hạn làm trang quá
            dài, kéo trình duyệt ì ạch. Giới hạn chiều cao ~10 dòng rồi cuộn
            trong khung thay vì cuộn cả trang; header dùng sticky để vẫn thấy
            tên cột khi đã cuộn xuống. Dữ liệu vẫn load đủ (không phân trang) —
            checkbox "chọn tất cả" vẫn chọn đúng toàn bộ, kể cả phần chưa
            cuộn tới. */}
        <div className="max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
            <tr>
              <th className="w-10 p-4">
                {assets.length > 0 && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={selectedIds.length === assets.length}
                    onChange={toggleAll}
                  />
                )}
              </th>
              <th className="p-4 text-left">Asset Tag</th>
              <th className="p-4 text-left">Model</th>
              <th className="p-4 text-left">Serial</th>
              <th className="p-4 text-left">Kho</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="border-t border-slate-100 hover:bg-blue-50/40"
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={selectedIds.includes(asset.id)}
                    onChange={() => toggleOne(asset.id)}
                  />
                </td>

                <td className="p-4 font-bold text-slate-900">
                  {asset.assetTag}
                </td>

                <td className="p-4">
                  {asset.model.brand} {asset.model.modelName}
                </td>

                <td className="p-4 text-slate-600">{asset.serialNumber}</td>

                <td className="p-4">
                  <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {asset.warehouse
                      ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                      : "-"}
                  </span>
                </td>

                <td className="p-4 text-right">
                  <Link
                    href={`/assets/${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Eye size={16} />
                    Xem
                  </Link>
                </td>
              </tr>
            ))}

            {assets.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-500">
                  Nhân viên này chưa được cấp thiết bị nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      {modal === "return" && (
        <ReturnModal
          employeeId={employeeId}
          assets={selectedAssets}
          warehouseOptions={returnWarehouseOptions}
          defaultWarehouseId={defaultReturnWarehouseId}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "transfer" && (
        <TransferModal
          employeeId={employeeId}
          assets={selectedAssets}
          employees={otherEmployees}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "assign" && (
        <AssignModal
          employeeId={employeeId}
          availableAssets={availableAssets}
          heldAssets={assets}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function ModalShell({
  title,
  desc,
  onClose,
  children,
}: {
  title: string;
  desc: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{desc}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function ReturnModal({
  employeeId,
  assets,
  warehouseOptions,
  defaultWarehouseId,
  onClose,
}: {
  employeeId: number;
  assets: AssetItem[];
  warehouseOptions: WarehouseOption[];
  defaultWarehouseId: number | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<
    EmployeeActionState,
    FormData
  >(bulkReturnAssetsAction, null);

  return (
    <ModalShell
      title="Xác nhận thu hồi thiết bị"
      desc={`${assets.length} thiết bị sẽ được chuyển về trạng thái Trong kho.`}
      onClose={onClose}
    >
      <form action={formAction} className="mt-5 space-y-5">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input
          type="hidden"
          name="assetIds"
          value={assets.map((a) => a.id).join(",")}
        />

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <TriangleAlert size={15} className="shrink-0" />
            {state.error}
          </div>
        )}

        <div className="space-y-3">
          {assets.map((asset) => {
            const currentAdapter = hasAccessory(asset.accessories, "adapter");
            const currentCable =
              hasAccessory(asset.accessories, "cáp") ||
              hasAccessory(asset.accessories, "cap") ||
              hasAccessory(asset.accessories, "cable");

            return (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="font-bold text-slate-900">
                  {asset.assetTag} — {asset.model.brand} {asset.model.modelName}
                </p>
                <p className="text-xs text-slate-500">{asset.serialNumber}</p>

                <div className="mt-3 flex gap-6 text-sm">
                  <label className="flex items-center gap-2 font-medium text-slate-700">
                    <input
                      name={`hasAdapter_${asset.id}`}
                      type="checkbox"
                      defaultChecked={currentAdapter}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Có Adapter
                  </label>

                  <label className="flex items-center gap-2 font-medium text-slate-700">
                    <input
                      name={`hasCable_${asset.id}`}
                      type="checkbox"
                      defaultChecked={currentCable}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Có dây sạc
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <ReturnWarehouseSelect
          options={warehouseOptions}
          defaultWarehouseId={defaultWarehouseId}
        />

        <div>
          <label className="text-sm font-medium">Lý do thu hồi</label>
          <select
            name="returnReason"
            required
            defaultValue=""
            className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
          >
            <option value="">Chọn lý do</option>
            <option value="Nhân viên nghỉ việc">Nhân viên nghỉ việc</option>
            <option value="Cấp đổi thiết bị">Cấp đổi thiết bị</option>
            <option value="Thiết bị hư hỏng">Thiết bị hư hỏng</option>
            <option value="Khác">Khác</option>
          </select>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <input
            name="sendToRepair"
            type="checkbox"
            className="h-4 w-4 accent-amber-600"
          />
          Gửi sửa chữa/bảo hành ngay (thay vì đưa về Trong kho) — áp dụng cho
          toàn bộ thiết bị đang chọn
        </label>

        <div>
          <label className="block text-sm font-medium">Ghi chú</label>
          <textarea
            name="returnNote"
            className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
            placeholder="Nhập ghi chú nếu có"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Đang xử lý..." : "Xác nhận thu hồi"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function TransferModal({
  employeeId,
  assets,
  employees,
  onClose,
}: {
  employeeId: number;
  assets: AssetItem[];
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<EmployeeOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, isPending] = useActionState<
    EmployeeActionState,
    FormData
  >(bulkTransferAssetsAction, null);

  // Trước đây bấm "Xác nhận chuyển" khi chưa chọn nhân viên nhận (hoặc gõ 1
  // cái tên không có trong danh sách gợi ý rồi bấm luôn) sẽ submit thẳng
  // xuống server với toEmployeeId rỗng — server báo lỗi nhưng UX không rõ
  // ràng bằng cảnh báo ngay tại chỗ. Giờ chặn ở client trước, giống pattern
  // đã dùng ở AssignAssetForm.
  function handleSubmitClick() {
    if (!selected) {
      setError("Vui lòng chọn nhân viên nhận thiết bị.");
      return;
    }

    setError(null);
    submitButtonRef.current?.click();
  }

  return (
    <ModalShell
      title="Chuyển thiết bị cho nhân viên khác"
      desc={`${assets.length} thiết bị sẽ được chuyển thẳng sang nhân viên bạn chọn bên dưới, không cần qua bước Thu hồi về kho.`}
      onClose={onClose}
    >
      <form action={formAction} className="mt-5 space-y-5">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input
          type="hidden"
          name="assetIds"
          value={assets.map((a) => a.id).join(",")}
        />

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <TriangleAlert size={15} className="shrink-0" />
            {state.error}
          </div>
        )}

        <div className="space-y-1 rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
          {assets.map((asset) => (
            <p key={asset.id}>
              <span className="font-bold text-slate-900">
                {asset.assetTag}
              </span>{" "}
              — {asset.model.brand} {asset.model.modelName}
            </p>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium">Chuyển đến nhân viên</label>
          <EmployeeSelect
            employees={employees}
            name="toEmployeeId"
            hasError={Boolean(error)}
            onSelectedChange={(employee) => {
              setSelected(employee);
              if (employee) setError(null);
            }}
          />

          {error && (
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-600">
              <TriangleAlert size={15} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Ghi chú</label>
          <textarea
            name="transferNote"
            className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
            placeholder="Nhập ghi chú nếu có"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Đang xử lý..." : "Xác nhận chuyển"}
          </button>
        </div>

        <button ref={submitButtonRef} type="submit" className="hidden" />
      </form>
    </ModalShell>
  );
}

function AssignModal({
  employeeId,
  availableAssets,
  heldAssets,
  onClose,
}: {
  employeeId: number;
  availableAssets: AvailableAsset[];
  // Thiết bị nhân viên ĐANG giữ — chỉ dùng để hiện picker chọn máy đổi khi
  // Loại cấp phát = "Cấp đổi thiết bị" (EXCHANGE). Cùng mảng "assets" đã có
  // sẵn ở EmployeeAssetsPanel (bảng "Thiết bị đang giữ"), không cần query
  // thêm.
  heldAssets: AssetItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [assignmentType, setAssignmentType] = useState<AssignmentType | "">("");
  const [exchangeAssetId, setExchangeAssetId] = useState("");
  const [state, formAction, isPending] = useActionState<
    EmployeeActionState,
    FormData
  >(assignAdditionalAssetAction, null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableAssets;

    return availableAssets.filter((asset) => {
      const haystack =
        `${asset.assetTag} ${asset.serialNumber} ${asset.model.brand} ${asset.model.modelName}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [availableAssets, query]);

  function toggleAsset(id: number) {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  // Chọn/bỏ chọn hết TOÀN BỘ kết quả đang lọc — hữu ích khi cần cấp cả chục
  // máy cùng model (VD gõ tên model để lọc còn đúng lô cần cấp rồi bấm 1 lần
  // thay vì tick tay từng dòng).
  function toggleAllFiltered() {
    const filteredIds = filtered.map((a) => a.id);
    const allSelected = filteredIds.every((id) => selectedAssetIds.includes(id));

    setSelectedAssetIds((prev) =>
      allSelected
        ? prev.filter((id) => !filteredIds.includes(id))
        : Array.from(new Set([...prev, ...filteredIds]))
    );
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((a) => selectedAssetIds.includes(a.id));

  return (
    <ModalShell
      title="Cấp thêm thiết bị"
      desc="Chọn 1 hoặc nhiều thiết bị đang Trong kho để cấp phát cùng lúc cho nhân viên này."
      onClose={onClose}
    >
      <form action={formAction} className="mt-5 space-y-5">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input
          type="hidden"
          name="assetIds"
          value={selectedAssetIds.join(",")}
        />
        <input type="hidden" name="assignmentType" value={assignmentType} />
        <input type="hidden" name="exchangeAssetId" value={exchangeAssetId} />

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <TriangleAlert size={15} className="shrink-0" />
            {state.error}
          </div>
        )}

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo Asset Tag, Serial, tên thiết bị..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
          />
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="h-4 w-4 accent-blue-600"
              />
              Chọn tất cả ({filtered.length} thiết bị đang hiển thị)
            </label>

            {selectedAssetIds.length > 0 && (
              <span className="text-xs font-bold text-blue-600">
                Đã chọn {selectedAssetIds.length}
              </span>
            )}
          </div>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">
              Không còn thiết bị nào trong kho phù hợp
            </p>
          )}

          {filtered.map((asset) => (
            <label
              key={asset.id}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                selectedAssetIds.includes(asset.id)
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedAssetIds.includes(asset.id)}
                  onChange={() => toggleAsset(asset.id)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="font-bold text-slate-900">
                    {asset.assetTag}
                  </span>{" "}
                  — {asset.model.brand} {asset.model.modelName}
                  <span className="ml-2 text-xs text-slate-500">
                    {asset.serialNumber}
                  </span>
                </span>
              </span>

              <span className="text-xs font-semibold text-blue-600">
                {asset.warehouse
                  ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                  : "-"}
              </span>
            </label>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium">Loại cấp phát</label>
          <select
            value={assignmentType}
            onChange={(e) => {
              const next = e.target.value as AssignmentType;
              setAssignmentType(next);
              // Đổi khỏi EXCHANGE (hoặc đổi lại) — xoá lựa chọn máy đổi cũ.
              if (next !== "EXCHANGE") setExchangeAssetId("");
            }}
            className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
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
              {ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === assignmentType)?.hint}
              {assignmentType !== "EXCHANGE" &&
                selectedAssetIds.length > 0 &&
                ` Áp dụng chung cho cả ${selectedAssetIds.length} thiết bị đang chọn.`}
            </p>
          )}

          {assignmentType === "EXCHANGE" && selectedAssetIds.length > 1 && (
            <div className="mt-1.5 flex items-center gap-2 text-xs font-medium text-rose-600">
              <TriangleAlert size={13} className="shrink-0" />
              Cấp đổi thiết bị chỉ áp dụng cho 1 thiết bị mới — vui lòng bỏ
              chọn bớt, chỉ giữ lại 1.
            </div>
          )}

          {assignmentType === "EXCHANGE" && selectedAssetIds.length <= 1 && (
            <div className="mt-3">
              <label className="text-sm font-medium">
                Thiết bị cần thu hồi để đổi
              </label>

              {heldAssets.length === 0 ? (
                <p className="mt-2 text-xs font-medium text-rose-600">
                  Nhân viên này hiện chưa giữ thiết bị nào để đổi.
                </p>
              ) : (
                <select
                  value={exchangeAssetId}
                  onChange={(e) => setExchangeAssetId(e.target.value)}
                  className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
                >
                  <option value="">-- Chọn thiết bị đang giữ --</option>
                  {heldAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} — {a.model.brand} {a.model.modelName} (
                      {a.serialNumber})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Ghi chú</label>
          <textarea
            name="assignNote"
            className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
            placeholder="Nhập ghi chú nếu có — áp dụng chung cho cả lô đang chọn"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={
              selectedAssetIds.length === 0 ||
              !assignmentType ||
              isPending ||
              (assignmentType === "EXCHANGE" &&
                (selectedAssetIds.length > 1 || !exchangeAssetId))
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending
              ? "Đang xử lý..."
              : selectedAssetIds.length > 1
                ? `Xác nhận cấp phát (${selectedAssetIds.length})`
                : "Xác nhận cấp phát"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
