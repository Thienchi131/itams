import AppLayout from "../../../components/AppLayout";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X } from "lucide-react";
import { updateUserAction } from "./actions";
import UserScopeSelect from "../../UserScopeSelect";
import ExtraWarehouseAccessPicker from "../../ExtraWarehouseAccessPicker";
import SubmitButton from "../../../components/SubmitButton";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["Admin"]);

  const { id } = await params;

  const [user, roles, regions, unassignedWarehouses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: Number(id) },
      include: { role: true, warehouseAccess: { select: { warehouseId: true } } },
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.region.findMany({
      include: { warehouses: { orderBy: { code: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { regionId: null },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!user) notFound();

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href={`/users/${user.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">
            Sửa tài khoản
          </h1>
          <p className="mt-2 text-slate-500">{user.fullName}</p>
        </div>

        <form action={updateUserAction}>
          <input type="hidden" name="id" value={user.id} />

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              Thông tin tài khoản
            </h2>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Full Name">
                <input
                  name="fullName"
                  defaultValue={user.fullName}
                  required
                  className="input-style"
                />
              </Field>

              <Field label="Username">
                <input
                  name="username"
                  defaultValue={user.username}
                  required
                  className="input-style"
                />
              </Field>

              <Field label="Role">
                <select
                  name="roleId"
                  defaultValue={user.roleId}
                  required
                  className="input-style"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Phạm vi xem">
                <UserScopeSelect
                  regions={regions}
                  unassignedWarehouses={unassignedWarehouses}
                  defaultRegionId={user.regionId}
                  defaultWarehouseId={user.warehouseId}
                />
              </Field>

              <div className="col-span-2">
                <Field label="Kho bổ sung (không bắt buộc)">
                  <ExtraWarehouseAccessPicker
                    regions={regions}
                    unassignedWarehouses={unassignedWarehouses}
                    defaultSelectedIds={user.warehouseAccess.map((w) => w.warehouseId)}
                  />
                </Field>
              </div>
            </div>
          </section>

          <div className="mt-6 flex justify-end gap-3">
            <Link
              href={`/users/${user.id}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X size={18} />
              Hủy
            </Link>

            <SubmitButton
              icon={<Save size={18} />}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Lưu thay đổi
            </SubmitButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}