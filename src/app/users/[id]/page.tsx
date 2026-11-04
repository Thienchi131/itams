import AppLayout from "../../components/AppLayout";
import { getUserById } from "@/modules/user/user.service";
import { requireRole } from "@/modules/auth/auth.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  UserCircle2,
  Shield,
  CalendarDays,
  KeyRound,
  Pencil,
  Warehouse,
} from "lucide-react";
import LocalDateTime from "../../components/LocalDateTime";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["Admin"]);

  const { id } = await params;
  const user = await getUserById(Number(id));

  if (!user) notFound();

  const scopeLabel = user.warehouse
    ? `Kho ${user.warehouse.code} - ${user.warehouse.name}`
    : user.region
      ? user.region.name
      : user.warehouseAccess.length > 0
        ? `${user.warehouseAccess.length} kho tuỳ chọn`
        : "Tất cả";

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-blue-600">
              <UserCircle2 size={42} />
            </div>

            <div>
              <h1 className="text-4xl font-extrabold text-slate-900">
                {user.fullName}
              </h1>

              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-700">
                  {user.username}
                </span>

                <RoleBadge role={user.role.name} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex gap-3">
  <Link
    href={`/users/${user.id}/edit`}
    className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 py-3 font-semibold text-blue-600 hover:bg-blue-50"
  >
    <Pencil size={18} />
    Sửa tài khoản
  </Link>

  <Link
    href={`/users/${user.id}/password`}
    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white"
  >
    <KeyRound size={18} />
    Đổi mật khẩu
  </Link>
</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          <SummaryCard
            icon={<UserCircle2 />}
            label="Username"
            value={user.username}
            color="blue"
          />

          <SummaryCard
            icon={<Shield />}
            label="Role"
            value={user.role.name}
            color="violet"
          />

          <SummaryCard
            icon={<Warehouse />}
            label="Khu vực"
            value={scopeLabel}
            color="orange"
          />

          <SummaryCard
            icon={<CalendarDays />}
            label="Ngày tạo"
            value={<LocalDateTime value={user.createdAt} />}
            color="emerald"
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-slate-900">
            Thông tin tài khoản
          </h2>

          <div className="space-y-4">
            <InfoRow label="Full Name" value={user.fullName} />
            <InfoRow label="Username" value={user.username} />
            <InfoRow label="Role" value={user.role.name} />
            <InfoRow
              label="Khu vực"
              value={
                user.warehouse
                  ? `Chỉ kho ${user.warehouse.code} - ${user.warehouse.name}`
                  : user.region
                    ? `Toàn bộ khu vực ${user.region.name}`
                    : "Tất cả (không giới hạn)"
              }
            />
            {user.warehouseAccess.length > 0 && (
              <InfoRow
                label="Kho bổ sung"
                value={user.warehouseAccess
                  .map((a) => `${a.warehouse.code} - ${a.warehouse.name}`)
                  .join(", ")}
              />
            )}
            <InfoRow
              label="Ngày tạo"
              value={<LocalDateTime value={user.createdAt} mode="datetime" />}
            />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function RoleBadge({ role }: { role: string }) {
  const color =
    role === "Admin"
      ? "bg-red-100 text-red-700"
      : role === "IT"
      ? "bg-blue-100 text-blue-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${color}`}>
      {role}
    </span>
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
  value: React.ReactNode;
  color: "blue" | "violet" | "emerald" | "orange";
}) {
  const theme = {
    blue: "bg-blue-100 text-blue-600",
    violet: "bg-violet-100 text-violet-600",
    emerald: "bg-emerald-100 text-emerald-600",
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}