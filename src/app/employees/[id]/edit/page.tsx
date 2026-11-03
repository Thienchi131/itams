import AppLayout from "../../../components/AppLayout";
import { getEmployeeById } from "@/modules/employee/employee.service";
import { requireRole } from "@/modules/auth/auth.service";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, TriangleAlert, X } from "lucide-react";
import { updateEmployeeAction } from "./actions";
import SubmitButton from "../../../components/SubmitButton";

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["Admin", "IT"]);

  const { id } = await params;
  const { error } = await searchParams;
  const employee = await getEmployeeById(Number(id));

  if (!employee) notFound();

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href={`/employees/${employee.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">
            Sửa nhân viên
          </h1>
          <p className="mt-2 text-slate-500">{employee.fullName}</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form action={updateEmployeeAction}>
          <input type="hidden" name="id" value={employee.id} />

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              Thông tin nhân viên
            </h2>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Mã nhân viên">
                <input
                  name="employeeCode"
                  defaultValue={employee.employeeCode}
                  required
                  className="input-style"
                />
              </Field>

              <Field label="Họ tên">
                <input
                  name="fullName"
                  defaultValue={employee.fullName}
                  required
                  className="input-style"
                />
              </Field>

              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  defaultValue={employee.email ?? ""}
                  className="input-style"
                />
              </Field>

              <Field label="Team">
                <input
                  name="teamName"
                  defaultValue={employee.team?.name ?? ""}
                  className="input-style"
                  placeholder="VD: IT / Finance / HR"
                />
              </Field>

              <Field label="Chức vụ">
                <input
                  name="positionName"
                  defaultValue={employee.position?.name ?? ""}
                  className="input-style"
                  placeholder="VD: IT Support / Accountant"
                />
              </Field>

              <Field label="Trạng thái">
                <select
                  name="isActive"
                  defaultValue={employee.isActive ? "true" : "false"}
                  className="input-style"
                >
                  <option value="true">Đang làm</option>
                  <option value="false">Đã nghỉ</option>
                </select>
              </Field>
            </div>
          </section>

          <div className="mt-6 flex justify-end gap-3">
            <Link
              href={`/employees/${employee.id}`}
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