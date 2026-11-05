"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import SubmitButton from "@/app/components/SubmitButton";
import { INVENTORY_SCOPE_LABEL, type InventoryScope } from "@/modules/inventory/inventory.helpers";
import { createInventoryAuditAction, type InventoryActionState } from "./actions";

type ItUser = { id: number; fullName: string; username: string };

type WarehouseOption = {
  id: number;
  label: string;
  inStock: number;
  pendingLiquidation: number;
  // IT có phạm vi kho bao gồm kho này — được phép chọn tham gia kiểm kê.
  itUsers: ItUser[];
};

export default function CreateAuditForm({
  warehouses,
  currentUserId,
  creatorIsIt,
}: {
  warehouses: WarehouseOption[];
  currentUserId: number;
  // Người tạo là IT thì luôn tham gia (server tự thêm) — hiện sẵn đã chọn.
  creatorIsIt: boolean;
}) {
  const [state, formAction, isPending] = useActionState<InventoryActionState, FormData>(
    createInventoryAuditAction,
    null
  );
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? String(warehouses[0].id) : "");
  const [scope, setScope] = useState<InventoryScope>("IN_STOCK");
  const [participantIds, setParticipantIds] = useState<number[]>([]);

  const selected = warehouses.find((w) => String(w.id) === warehouseId);
  const count = selected
    ? scope === "IN_STOCK"
      ? selected.inStock
      : selected.pendingLiquidation
    : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Kho kiểm kê</span>
          <select
            name="warehouseId"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              // Mỗi kho có danh sách IT khác nhau — đổi kho thì chọn lại.
              setParticipantIds([]);
            }}
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
          >
            <option value="">-- Chọn kho --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-sm font-semibold text-slate-700">Hạng mục kiểm kê</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(INVENTORY_SCOPE_LABEL) as InventoryScope[]).map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition ${
                  scope === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value={key}
                  checked={scope === key}
                  onChange={() => setScope(key)}
                  className="sr-only"
                />
                {INVENTORY_SCOPE_LABEL[key]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {count !== null && (
        <p className={`text-sm font-medium ${count > 0 ? "text-slate-600" : "text-rose-600"}`}>
          {count > 0
            ? `Danh sách kiểm kê sẽ gồm ${count} thiết bị hiện có trong kho này.`
            : "Kho này hiện không có thiết bị nào thuộc hạng mục đã chọn."}
        </p>
      )}

      {selected && (
        <div>
          <span className="text-sm font-semibold text-slate-700">IT tham gia kiểm kê</span>
          <p className="mt-0.5 text-xs text-slate-500">
            Chỉ IT được chọn (và Admin) mới thấy đợt kiểm kê này và chụp xác nhận được.
          </p>

          {selected.itUsers.length === 0 ? (
            <p className="mt-2 text-sm font-medium text-rose-600">
              Chưa có tài khoản IT nào phụ trách kho này.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.itUsers.map((user) => {
                const isCreator = creatorIsIt && user.id === currentUserId;
                const checked = isCreator || participantIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    } ${isCreator ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      name={isCreator ? undefined : "participantIds"}
                      value={user.id}
                      checked={checked}
                      disabled={isCreator}
                      onChange={() =>
                        setParticipantIds((prev) =>
                          prev.includes(user.id)
                            ? prev.filter((id) => id !== user.id)
                            : [...prev, user.id]
                        )
                      }
                      className="h-4 w-4 accent-blue-600"
                    />
                    {user.fullName}
                    {isCreator && <span className="text-xs text-blue-500">(bạn)</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Ghi chú (không bắt buộc)</span>
        <input
          name="note"
          maxLength={500}
          placeholder="VD: Kiểm kê định kỳ quý 4"
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
        />
      </label>

      {state?.error && (
        <div className="flex items-center gap-2 text-sm font-medium text-rose-600">
          <TriangleAlert size={15} className="shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex justify-end">
        <SubmitButton
          pending={isPending}
          pendingText="Đang tạo..."
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Tạo đợt kiểm kê
        </SubmitButton>
      </div>
    </form>
  );
}
