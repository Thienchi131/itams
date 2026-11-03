"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Save, X, TriangleAlert } from "lucide-react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

export default function ChangePasswordForm({ userId }: { userId: number }) {
  const [state, formAction, isPending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={userId} />

      {state?.error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          <Field label="Password mới">
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="input-style"
              placeholder="Nhập password mới"
            />
          </Field>

          <Field label="Nhập lại password">
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              className="input-style"
              placeholder="Nhập lại password mới"
            />
          </Field>
        </div>
      </section>

      <div className="mt-6 flex justify-end gap-3">
        <Link
          href={`/users/${userId}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <X size={18} />
          Hủy
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={18} />
          {isPending ? "Đang lưu..." : "Lưu mật khẩu"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      {children}
    </div>
  );
}
