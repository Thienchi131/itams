import AppLayout from "../components/AppLayout";
import { getUsers } from "@/modules/user/user.service";
import { requireRole } from "@/modules/auth/auth.service";
import Link from "next/link";
import {
  resetUserPasswordAction,
  resetUserTwoFactorAction,
  deleteUserAction,
} from "./actions";
import ConfirmActionForm from "@/app/components/ConfirmActionForm";
import LocalDateTime from "../components/LocalDateTime";
import {
  Search,
  Plus,
  UserCircle2,
  Shield,
  ShieldCheck,
  ShieldOff,
  CalendarDays,
  Eye,
  KeyRound,
  Trash2,
  Warehouse,
} from "lucide-react";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(["Admin"]);

  const { q } = await searchParams;
  const users = await getUsers(q);

  const adminCount = users.filter((u) => u.role.name === "Admin").length;
  const itCount = users.filter((u) => u.role.name === "IT").length;
  const userCount = users.length - adminCount - itCount;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Quản lý tài khoản
          </h2>

          <p className="mt-1 text-slate-500">
            Tổng cộng{" "}
            <span className="font-bold text-slate-900">
              {users.length}
            </span>{" "}
            tài khoản ·{" "}
            <span className="font-bold text-red-600">
              {adminCount}
            </span>{" "}
            Admin ·{" "}
            <span className="font-bold text-blue-600">
              {itCount}
            </span>{" "}
            IT ·{" "}
            <span className="font-bold text-emerald-600">
              {userCount}
            </span>{" "}
            User
          </p>
        </div>

        <Link
          href="/users/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md"
        >
          <Plus size={18} />
          Thêm User
        </Link>
      </div>

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
              placeholder="Tìm Username, Full Name hoặc Role..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </form>

        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 text-left">User</th>
              <th className="p-4 text-left">Role</th>
              <th className="p-4 text-left">Khu vực</th>
              <th className="p-4 text-left">2FA</th>
              <th className="p-4 text-left">Ngày tạo</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-t border-slate-100 transition hover:bg-blue-50/40"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <UserCircle2 size={22} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {user.fullName}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {user.username}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-4">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-semibold
                    ${
                      user.role.name === "Admin"
                        ? "bg-red-100 text-red-700"
                        : user.role.name === "IT"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    <Shield size={14} />
                    {user.role.name}
                  </span>
                </td>

                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {user.warehouse ? (
                      <span
                        className="inline-flex max-w-[180px] items-center gap-1.5 truncate whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700"
                        title={`Kho ${user.warehouse.code} - ${user.warehouse.name}`}
                      >
                        <Warehouse size={14} className="shrink-0" />
                        <span className="truncate">
                          {user.warehouse.code} - {user.warehouse.name}
                        </span>
                      </span>
                    ) : user.region ? (
                      <span
                        className="inline-flex max-w-[180px] items-center gap-1.5 truncate whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700"
                        title={user.region.name}
                      >
                        <Warehouse size={14} className="shrink-0" />
                        <span className="truncate">{user.region.name}</span>
                      </span>
                    ) : user.warehouseAccess.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">
                        <Warehouse size={14} />
                        Tất cả
                      </span>
                    ) : null}

                    {user.warehouseAccess.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700"
                        title={`Kho bổ sung: ${user.warehouseAccess
                          .map((a) => `${a.warehouse.code} - ${a.warehouse.name}`)
                          .join(", ")}`}
                      >
                        <Warehouse size={14} />+{user.warehouseAccess.length} kho khác
                      </span>
                    )}
                  </div>
                </td>

                <td className="p-4">
                  {user.twoFactorEnabled ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                      <ShieldCheck size={14} />
                      Đã bật
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
                      <ShieldOff size={14} />
                      Chưa bật
                    </span>
                  )}
                </td>

                <td className="p-4 whitespace-nowrap text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays
                      size={15}
                      className="text-slate-400"
                    />

                    <LocalDateTime value={user.createdAt} />
                  </span>
                </td>

                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      href={`/users/${user.id}`}
                      title="Xem"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={16} />
                    </Link>

                    <ConfirmActionForm
                      action={resetUserPasswordAction}
                      userId={user.id}
                      label="Reset password"
                      title="Xác nhận reset password"
                      message={`Bạn có chắc muốn reset password cho tài khoản ${user.fullName}? Password mới sẽ được gửi về email.`}
                      confirmLabel="Reset"
                      color="amber"
                      icon={<KeyRound size={16} />}
                      iconOnly
                    />

                    {user.twoFactorEnabled && (
                      <ConfirmActionForm
                        action={resetUserTwoFactorAction}
                        userId={user.id}
                        label="Reset 2FA"
                        title="Xác nhận reset 2FA"
                        message={`Bạn có chắc muốn tắt xác thực 2 lớp của tài khoản ${user.fullName}? Dùng khi họ mất điện thoại/đổi máy — lần đăng nhập kế tiếp họ sẽ phải thiết lập lại 2FA từ đầu.`}
                        confirmLabel="Reset 2FA"
                        color="amber"
                        icon={<ShieldOff size={16} />}
                        iconOnly
                      />
                    )}

                    <ConfirmActionForm
                      action={deleteUserAction}
                      userId={user.id}
                      label="Xoá tài khoản"
                      title="Xác nhận xoá tài khoản"
                      message={`Bạn có chắc muốn xoá tài khoản ${user.fullName}? Hành động này không nên thực hiện nếu user vẫn còn sử dụng hệ thống.`}
                      confirmLabel="Xoá"
                      color="rose"
                      icon={<Trash2 size={16} />}
                      iconOnly
                    />
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-slate-500"
                >
                  Chưa có tài khoản nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </AppLayout>
  );
}