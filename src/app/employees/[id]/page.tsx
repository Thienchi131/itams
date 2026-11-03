import AppLayout from "../../components/AppLayout";
import {
  getEmployeeById,
  getEmployees,
} from "@/modules/employee/employee.service";
import { getAvailableAssetsForAssignment } from "@/modules/asset/asset.service";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData } from "@/modules/auth/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import LocalDateTime from "../../components/LocalDateTime";
import EmployeeAssetsPanel from "./EmployeeAssetsPanel";

import {
  ArrowLeft,
  UserRound,
  Mail,
  Users,
  Briefcase,
  Laptop,
  Eye,
  BadgeCheck,
  Pencil,
} from "lucide-react";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireLogin();
  const canEdit = canEditData(currentUser.role.name);

  const { id } = await params;
  const employee = await getEmployeeById(Number(id));

  if (!employee) notFound();

  // Nhân viên là danh bạ chung, không scope theo kho/khu vực — mọi tài
  // khoản có quyền xem đều thấy được mọi nhân viên (xem employee.service.ts).
  // Thiết bị khả dụng để gán thì vẫn giới hạn theo đúng phạm vi kho của tài
  // khoản như bình thường.
  const [availableAssets, allEmployees] = canEdit
    ? await Promise.all([
        getAvailableAssetsForAssignment(currentUser.regionWarehouseIds),
        getEmployees(),
      ])
    : [[], []];

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
<div className="flex items-center justify-between">
  <div className="flex items-center gap-5">
    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-blue-600">
      <UserRound size={38} />
    </div>

    <div>
      <h1 className="text-4xl font-extrabold text-slate-900">
        {employee.fullName}
      </h1>

      <div className="mt-3 flex items-center gap-3">
        <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-700">
          {employee.employeeCode}
        </span>

        <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-bold text-emerald-700">
          {employee.isActive ? "Đang làm" : "Đã nghỉ"}
        </span>
      </div>
    </div>
  </div>

  {canEdit && (
    <Link
      href={`/employees/${employee.id}/edit`}
      className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50"
    >
      <Pencil size={18} />
      Sửa nhân viên
    </Link>
  )}
</div>

        <div className="grid grid-cols-4 gap-5">
          <SummaryCard
            icon={<Mail />}
            label="Email"
            value={employee.email ?? "-"}
            color="blue"
          />

          <SummaryCard
            icon={<Users />}
            label="Team"
            value={employee.team?.name ?? "-"}
            color="emerald"
          />

          <SummaryCard
            icon={<Briefcase />}
            label="Chức vụ"
            value={employee.position?.name ?? "-"}
            color="violet"
          />

          <SummaryCard
            icon={<Laptop />}
            label="Thiết bị"
            value={`${employee.assets.length}`}
            color="orange"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              Thông tin nhân viên
            </h2>

            <div className="space-y-4">
              <InfoRow label="Mã nhân viên" value={employee.employeeCode} />
              <InfoRow label="Họ tên" value={employee.fullName} />
              <InfoRow label="Email" value={employee.email ?? "-"} />
              <InfoRow label="Team" value={employee.team?.name ?? "-"} />
              <InfoRow label="Chức vụ" value={employee.position?.name ?? "-"} />
              <InfoRow
                label="Trạng thái"
                value={employee.isActive ? "Đang làm" : "Đã nghỉ"}
              />
            </div>
          </section>

          {canEdit ? (
            <EmployeeAssetsPanel
              employeeId={employee.id}
              assets={employee.assets}
              availableAssets={availableAssets}
              employees={allEmployees}
            />
          ) : (
            <section className="col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Thiết bị đang giữ
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Danh sách thiết bị đang được gán cho nhân viên này
                </p>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-4 text-left">Asset Tag</th>
                    <th className="p-4 text-left">Model</th>
                    <th className="p-4 text-left">Serial</th>
                    <th className="p-4 text-left">Kho</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {employee.assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="border-t border-slate-100 hover:bg-blue-50/40"
                    >
                      <td className="p-4 font-bold text-slate-900">
                        {asset.assetTag}
                      </td>

                      <td className="p-4">
                        {asset.model.brand} {asset.model.modelName}
                      </td>

                      <td className="p-4 text-slate-600">
                        {asset.serialNumber}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {asset.warehouse
                            ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                            : "-"}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          <Eye size={16} />
                          Xem
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {employee.assets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-500">
                        Nhân viên này chưa được cấp thiết bị nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-900">
            Timeline
          </h2>

          <div className="relative border-l-2 border-slate-200 pl-6">
            <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-emerald-500" />

            <div className="grid grid-cols-4 gap-6 text-sm">
              <div>
                <p className="font-bold text-slate-900">
                  <BadgeCheck className="mr-2 inline h-4 w-4 text-emerald-500" />
                  Hồ sơ nhân viên
                </p>
                <p className="mt-1 text-slate-500">
                  <LocalDateTime value={employee.createdAt} mode="datetime" />
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Team</p>
                <p className="text-slate-500">{employee.team?.name ?? "-"}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Chức vụ</p>
                <p className="text-slate-500">
                  {employee.position?.name ?? "-"}
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Ghi chú</p>
                <p className="text-slate-500">Nhân viên được tạo trong hệ thống</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "emerald" | "violet" | "orange";
}) {
  const theme = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    violet: "bg-violet-100 text-violet-600",
    orange: "bg-orange-100 text-orange-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${theme[color]}`}
      >
        {icon}
      </div>

      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
        {value}
      </h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}