import AppLayout from "../../components/AppLayout";
import { requireRole } from "@/modules/auth/auth.service";
import Link from "next/link";
import { ArrowLeft, Save, TriangleAlert, X } from "lucide-react";
import { createEmployeeAction } from "./actions";
import SubmitButton from "../../components/SubmitButton";

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["Admin", "IT"]);

  const { error } = await searchParams;

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href="/employees"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">
            Thêm nhân viên
          </h1>
          <p className="mt-2 text-slate-500">Tạo hồ sơ nhân viên mới</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form action={createEmployeeAction}>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              Thông tin nhân viên
            </h2>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Mã nhân viên">
                <input
                  name="employeeCode"
                  className="input-style"
                  placeholder="VD: EMP-0003 (để trống sẽ tự tạo mã tạm)"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Chưa có mã chính thức? Để trống — hệ thống tự tạo mã tạm, có thể sửa lại sau.
                </p>
              </Field>

              <Field label="Họ tên">
                <input name="fullName" required className="input-style" />
              </Field>

              <Field label="Email">
                <input name="email" type="email" className="input-style" />
              </Field>

              <Field label="Team">
                <input
                  name="teamName"
                  className="input-style"
                  placeholder="VD: IT / Finance / HR"
                />
              </Field>

              <Field label="Chức vụ">
                <input
                  name="positionName"
                  className="input-style"
                  placeholder="VD: IT Support / Accountant"
                />
              </Field>

              <Field label="Trạng thái">
                <select
                  name="isActive"
                  defaultValue="true"
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
              href="/employees"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X size={18} />
              Hủy
            </Link>

            <SubmitButton
              icon={<Save size={18} />}
              pendingText="Đang lưu..."
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Lưu nhân viên
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
