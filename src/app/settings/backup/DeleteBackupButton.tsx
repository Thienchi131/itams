"use client";

import { useActionState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import { deleteBackupAction, type BackupActionState } from "./actions";

export default function DeleteBackupButton({ name }: { name: string }) {
  const [state, formAction] = useActionState<BackupActionState, FormData>(
    deleteBackupAction,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="name" value={name} />
      <ConfirmActionButton
        label="Xoá"
        confirmTitle="Xoá file backup này?"
        confirmMessage={`File "${name}" sẽ bị xoá vĩnh viễn khỏi máy chủ. Không ảnh hưởng gì tới dữ liệu đang chạy trong hệ thống.`}
        confirmLabel="Xoá"
        color="rose"
        icon={<Trash2 size={14} />}
      />

      {state?.error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <TriangleAlert size={13} className="shrink-0" />
          {state.error}
        </div>
      )}
    </form>
  );
}
