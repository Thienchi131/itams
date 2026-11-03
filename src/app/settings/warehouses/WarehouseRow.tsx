"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check, Monitor, MapPin, Users } from "lucide-react";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import SubmitButton from "@/app/components/SubmitButton";
import { updateWarehouseAction, deleteWarehouseAction } from "./actions";

type Warehouse = {
  id: number;
  code: string;
  name: string;
  regionId: number | null;
  isShared: boolean;
  region: { id: number; name: string } | null;
  _count: { assets: number; supplies: number };
};

export default function WarehouseRow({
  warehouse,
  regions,
}: {
  warehouse: Warehouse;
  regions: { id: number; name: string }[];
}) {
  const [editing, setEditing] = useState(false);

  const canDelete = warehouse._count.assets === 0 && warehouse._count.supplies === 0;

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-blue-50/40">
        <td className="p-4" colSpan={5}>
          <form
            action={updateWarehouseAction}
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="id" value={warehouse.id} />

            <input
              name="code"
              defaultValue={warehouse.code}
              maxLength={10}
              required
              placeholder="Mã kho"
              className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold uppercase outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />

            <input
              name="name"
              defaultValue={warehouse.name}
              required
              placeholder="Tên kho"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />

            <select
              name="regionId"
              defaultValue={warehouse.regionId ?? ""}
              className="w-44 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">-- Không thuộc khu vực --</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                name="isShared"
                defaultChecked={warehouse.isShared}
                className="h-4 w-4 accent-blue-600"
              />
              Dùng chung
            </label>

            <SubmitButton
              pendingText="Đang lưu..."
              icon={<Check size={15} />}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Lưu
            </SubmitButton>

            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X size={15} />
              Huỷ
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 transition hover:bg-blue-50/40">
      <td className="p-4">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
          {warehouse.code}
        </span>
      </td>

      <td className="p-4 font-semibold text-slate-900">{warehouse.name}</td>

      <td className="p-4 text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Monitor size={14} className="text-slate-400" />
          {warehouse._count.assets}
        </span>
      </td>

      <td className="p-4 text-slate-600">
        <div className="flex flex-wrap items-center gap-1.5">
          {warehouse.region ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              <MapPin size={13} />
              {warehouse.region.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400">-- Chưa gán --</span>
          )}

          {warehouse.isShared && (
            <span
              title="Kho dùng chung — hiển thị/thao tác được cho tất cả mọi người"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
            >
              <Users size={13} />
              Dùng chung
            </span>
          )}
        </div>
      </td>

      <td className="p-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            <Pencil size={15} />
            Sửa
          </button>

          {canDelete ? (
            <form action={deleteWarehouseAction}>
              <input type="hidden" name="id" value={warehouse.id} />
              <ConfirmActionButton
                label="Xoá"
                confirmTitle="Xác nhận xoá kho"
                confirmMessage={`Bạn có chắc muốn xoá kho ${warehouse.code} - ${warehouse.name}?`}
                confirmLabel="Xoá"
                color="rose"
                icon={<Trash2 size={15} />}
              />
            </form>
          ) : (
            <span
              title="Còn tài sản hoặc vật tư đang gán vào kho này — chuyển hết đi trước khi xoá"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-300"
            >
              <Trash2 size={15} />
              Xoá
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
