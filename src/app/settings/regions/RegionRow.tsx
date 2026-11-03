"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check, Warehouse as WarehouseIcon, Users as UsersIcon } from "lucide-react";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import SubmitButton from "@/app/components/SubmitButton";
import { updateRegionAction, deleteRegionAction } from "./actions";

type Region = {
  id: number;
  name: string;
  _count: { warehouses: number; users: number };
};

export default function RegionRow({ region }: { region: Region }) {
  const [editing, setEditing] = useState(false);

  const canDelete = region._count.warehouses === 0 && region._count.users === 0;

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-blue-50/40">
        <td className="p-4" colSpan={4}>
          <form
            action={updateRegionAction}
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="id" value={region.id} />

            <input
              name="name"
              defaultValue={region.name}
              required
              placeholder="Tên khu vực"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />

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
      <td className="p-4 font-semibold text-slate-900">{region.name}</td>

      <td className="p-4 text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <WarehouseIcon size={14} className="text-slate-400" />
          {region._count.warehouses}
        </span>
      </td>

      <td className="p-4 text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <UsersIcon size={14} className="text-slate-400" />
          {region._count.users}
        </span>
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
            <form action={deleteRegionAction}>
              <input type="hidden" name="id" value={region.id} />
              <ConfirmActionButton
                label="Xoá"
                confirmTitle="Xác nhận xoá khu vực"
                confirmMessage={`Bạn có chắc muốn xoá khu vực ${region.name}?`}
                confirmLabel="Xoá"
                color="rose"
                icon={<Trash2 size={15} />}
              />
            </form>
          ) : (
            <span
              title="Còn kho hoặc tài khoản đang gán vào khu vực này — gỡ hết trước khi xoá"
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
