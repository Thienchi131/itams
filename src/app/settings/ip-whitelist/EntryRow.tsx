"use client";

import { Trash2 } from "lucide-react";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import { deleteEntryAction } from "./actions";

type Entry = {
  id: number;
  cidr: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
};

export default function EntryRow({ entry }: { entry: Entry }) {
  return (
    <tr className="border-t border-slate-100 transition hover:bg-blue-50/40">
      <td className="p-4">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
          {entry.cidr}
        </span>
      </td>

      <td className="p-4 text-slate-600">{entry.description || "—"}</td>

      <td className="p-4 text-slate-500">{entry.createdBy}</td>

      <td className="p-4 text-slate-500">
        {new Date(entry.createdAt).toLocaleString("vi-VN")}
      </td>

      <td className="p-4 text-right">
        <form action={deleteEntryAction}>
          <input type="hidden" name="id" value={entry.id} />
          <ConfirmActionButton
            label="Xoá"
            confirmTitle="Xác nhận xoá khỏi whitelist"
            confirmMessage={`Bạn có chắc muốn xoá "${entry.cidr}" khỏi danh sách? Nếu whitelist đang BẬT, mọi thiết bị đang truy cập từ IP này sẽ bị chặn ngay sau khi xoá.`}
            confirmLabel="Xoá"
            color="rose"
            icon={<Trash2 size={15} />}
          />
        </form>
      </td>
    </tr>
  );
}
