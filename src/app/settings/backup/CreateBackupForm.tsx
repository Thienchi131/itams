"use client";

import { useActionState } from "react";
import { DatabaseBackup, TriangleAlert } from "lucide-react";
import SubmitButton from "@/app/components/SubmitButton";
import { createBackupAction, type BackupActionState } from "./actions";

export default function CreateBackupForm() {
  const [state, formAction, isPending] = useActionState<
    BackupActionState,
    FormData
  >(createBackupAction, null);

  return (
    <form action={formAction}>
      <SubmitButton
        pending={isPending}
        pendingText="Đang tạo backup..."
        icon={<DatabaseBackup size={16} />}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
      >
        Tạo backup ngay
      </SubmitButton>

      {state?.error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          <TriangleAlert size={15} className="shrink-0" />
          {state.error}
        </div>
      )}
    </form>
  );
}
