"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { createUserAction, type CreateUserState } from "./actions";
import UserScopeSelect from "../UserScopeSelect";
import ExtraWarehouseAccessPicker from "../ExtraWarehouseAccessPicker";

type Warehouse = { id: number; code: string; name: string };
type Region = { id: number; name: string; warehouses: Warehouse[] };
type Role = { id: number; name: string };

export default function NewUserForm({
  roles,
  regions,
  unassignedWarehouses,
}: {
  roles: Role[];
  regions: Region[];
  unassignedWarehouses: Warehouse[];
}) {
  const [state, formAction, isPending] = useActionState<CreateUserState, FormData>(
    createUserAction,
    null
  );

  return (
    <form action={formAction}>
      {state?.error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Họ và tên
            </label>

            <input
              name="fullName"
              required
              placeholder="Nguyễn Văn A"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Gmail / Email
            </label>

            <input
              name="email"
              type="email"
              required
              placeholder="user@company.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Quyền
            </label>

            <select
              name="roleId"
              required
              defaultValue=""
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500"
            >
              <option value="">Chọn quyền</option>

              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Phạm vi xem
            </label>

            <UserScopeSelect
              regions={regions}
              unassignedWarehouses={unassignedWarehouses}
              defaultRegionId={null}
              defaultWarehouseId={null}
            />
          </div>

          <div className="flex items-end">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              Password sẽ được hệ thống tự tạo và gửi về email của người dùng.
            </div>
          </div>

          <div className="col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Kho bổ sung (không bắt buộc)
            </label>

            <ExtraWarehouseAccessPicker
              regions={regions}
              unassignedWarehouses={unassignedWarehouses}
              defaultSelectedIds={[]}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <Link
          href="/users"
          className="rounded-xl border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-50"
        >
          Hủy
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Đang tạo..." : "Tạo tài khoản"}
        </button>
      </div>
    </form>
  );
}
