import AppLayout from "../components/AppLayout";
import {
  getEmployeesPaginated,
  getDuplicateEmployeeGroups,
} from "@/modules/employee/employee.service";
import MergeEmployeesForm from "./MergeEmployeesForm";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData } from "@/modules/auth/permissions";
import Link from "next/link";
import Pagination from "../components/Pagination";
import {
  Search,
  Plus,
  UserRound,
  Mail,
  Briefcase,
  Users,
  Laptop,
  Eye,
  TriangleAlert,
} from "lucide-react";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const currentUser = await requireLogin();
  const canEdit = canEditData(currentUser.role.name);

  const { q, page } = await searchParams;
  const currentPage = Number(page ?? "1");

  const [{ employees, total, totalActive, totalPages }, duplicateGroups] =
    await Promise.all([
      getEmployeesPaginated(q, currentPage),
      getDuplicateEmployeeGroups(),
    ]);

  const totalEmployees = total;
  const activeEmployees = totalActive;
  const inactiveEmployees = totalEmployees - activeEmployees;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Quản lý nhân viên
          </h2>
          <p className="mt-1 text-slate-500">
            Tổng cộng{" "}
            <span className="font-bold text-slate-900">{totalEmployees}</span>{" "}
            nhân viên ·{" "}
            <span className="font-bold text-emerald-600">
              {activeEmployees}
            </span>{" "}
            đang làm ·{" "}
            <span className="font-bold text-rose-600">
              {inactiveEmployees}
            </span>{" "}
            đã nghỉ
          </p>
        </div>

        {canEdit && (
          <Link
            href="/employees/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            Thêm nhân viên
          </Link>
        )}
      </div>

      {duplicateGroups.length > 0 && (
        <div className="mb-6 space-y-4">
          {duplicateGroups.map((group) => (
            <div
              key={group.map((e) => e.id).join("-")}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
            >
              <div className="mb-3 flex items-center gap-2 text-amber-800">
                <TriangleAlert size={18} />
                <p className="font-bold">
                  Phát hiện {group.length} nhân viên trùng tên &quot;
                  {group[0].fullName}&quot;
                </p>
              </div>

              <p className="mb-4 text-sm text-amber-700">
                Có thể do lỗi nhập liệu (import trùng, tạo 2 mã nhân viên cho
                cùng 1 người). Chọn bản ghi muốn giữ lại — toàn bộ thiết bị và
                lịch sử của các bản còn lại sẽ được dồn về bản này, sau đó các
                bản trùng sẽ bị xoá.
              </p>

              <MergeEmployeesForm group={group} canEdit={canEdit} />
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form className="border-b border-slate-100 p-5">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              name="q"
              defaultValue={q ?? ""}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Tìm theo mã nhân viên, tên, email, team hoặc chức vụ..."
            />
          </div>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">Nhân viên</th>
              <th className="p-4 text-left">Mã NV</th>
              <th className="p-4 text-left">Team</th>
              <th className="p-4 text-left">Chức vụ</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-center">Thiết bị</th>
              <th className="p-4 text-left">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className="border-t border-slate-100 transition hover:bg-blue-50/40"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <UserRound size={20} />
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">
                        {employee.fullName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {employee.email ?? "Chưa có email"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                    {employee.employeeCode}
                  </span>
                </td>

                <td className="p-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                    <Users size={14} />
                    {employee.team?.name ?? "-"}
                  </span>
                </td>

                <td className="p-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 font-semibold text-violet-700">
                    <Briefcase size={14} />
                    {employee.position?.name ?? "-"}
                  </span>
                </td>

                <td className="p-4 text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <Mail size={15} className="text-slate-400" />
                    {employee.email ?? "-"}
                  </span>
                </td>

                <td className="p-4 text-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                    <Laptop size={15} />
                    {employee.assets.length}
                  </span>
                </td>

                <td className="p-4">
                  {employee.isActive ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                      Đang làm
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-3 py-1 font-bold text-rose-700">
                      Đã nghỉ
                    </span>
                  )}
                </td>

                <td className="p-4 text-right">
                  <Link
                    href={`/employees/${employee.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Eye size={16} />
                    Xem
                  </Link>
                </td>
              </tr>
            ))}

            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-500">
                  Không tìm thấy nhân viên phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/employees"
          query={{ q }}
        />
      </div>
    </AppLayout>
  );
}