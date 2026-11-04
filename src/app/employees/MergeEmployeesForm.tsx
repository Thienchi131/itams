"use client";

import { useActionState, useEffect } from "react";
import { showToast } from "@/lib/flash";
import { TriangleAlert } from "lucide-react";
import { mergeEmployeesAction, type MergeEmployeesState } from "./merge/actions";

type Employee = {
  id: number;
  fullName: string;
  employeeCode: string;
  team?: { name: string } | null;
  assets: unknown[];
};

export default function MergeEmployeesForm({
  group,
  canEdit,
}: {
  group: Employee[];
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    MergeEmployeesState,
    FormData
  >(mergeEmployeesAction, null);

  // Action không redirect -> tự hiện toast khi trả về success.
  useEffect(() => {
    if (state?.success) showToast(state.success);
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
      <input
        type="hidden"
        name="groupIds"
        value={group.map((e) => e.id).join(",")}
      />

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          <TriangleAlert size={15} className="shrink-0" />
          {state.error}
        </div>
      )}

      {group.map((employee, idx) => (
        <label
          key={employee.id}
          className="flex cursor-pointer items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3 has-[:checked]:border-amber-500 has-[:checked]:ring-2 has-[:checked]:ring-amber-200"
        >
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name="primaryId"
              value={employee.id}
              defaultChecked={idx === 0}
              disabled={!canEdit}
            />
            <span>
              <span className="font-bold text-slate-900">
                {employee.fullName}
              </span>{" "}
              <span className="text-xs text-slate-500">
                ({employee.employeeCode})
              </span>
              {employee.team?.name && (
                <span className="ml-2 text-xs text-slate-500">
                  · {employee.team.name}
                </span>
              )}
            </span>
          </span>

          <span className="text-sm font-semibold text-emerald-700">
            {employee.assets.length} thiết bị
          </span>
        </label>
      ))}

      {canEdit && (
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Đang gộp..." : "Gộp nhân viên"}
        </button>
      )}
    </form>
  );
}
