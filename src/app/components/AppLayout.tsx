export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Home,
  Monitor,
  BookOpen,
  Package,
  Users,
  ShieldUser,
  Settings,
  LogOut,
  KeyRound,
  FileBarChart,
  TriangleAlert,
  Truck,
} from "lucide-react";

import { requireLogin } from "@/modules/auth/auth.service";
import { canAccessMenu, ROLE_IT } from "@/modules/auth/permissions";
import { logoutAction } from "@/app/logout/actions";
import {
  getAssetsInRepair,
  getPendingIncomingTransfers,
  getRecentlyRejectedTransfers,
} from "@/modules/asset/asset.service";

import AppMenuLink from "./AppMenuLink";
import AppTopbar from "./AppTopbar";
import NotificationBell from "./NotificationBell";
import RejectedTransferBanner from "./RejectedTransferBanner";

export default async function AppLayout({
  children,
  hideTopbar = false,
}: {
  children: React.ReactNode;
  // Dashboard tự vẽ banner riêng có chuông thông báo lồng bên trong, nên
  // không cần hàng topbar mặc định (tránh 1 dải trống phía trên banner).
  hideTopbar?: boolean;
}) {
  const user = await requireLogin();
  const roleName = user.role.name;

  // Banner nhắc "bắt buộc" cập nhật hướng xử lý cho thiết bị sửa chữa/bảo
  // hành quá hạn — CHỈ tính cho role IT (theo đúng phạm vi kho họ phụ
  // trách, dùng chung regionWarehouseIds đã tính sẵn ở getCurrentUser(),
  // giống mọi trang lọc-theo-kho khác trong hệ thống), Admin/User không bị
  // làm phiền. Đặt ở AppLayout (chạy trên MỌI trang, không riêng Dashboard)
  // để banner luôn hiện cho tới khi IT bấm vào xử lý — không phải trang nào
  // cũng chặn nổi nếu chỉ đặt ở 1 trang riêng lẻ.
  const needsFollowUpAssets =
    roleName === ROLE_IT
      ? (await getAssetsInRepair(user.regionWarehouseIds)).filter(
          (asset) => asset.needsFollowUp
        )
      : [];

  // Banner "bắt buộc" xác nhận nhập kho cho thiết bị đang chuyển ĐẾN kho
  // mình phụ trách. Trước đây CHẶN hẳn không gọi (trả mảng rỗng) cho tài
  // khoản Admin không giới hạn (regionWarehouseIds=null, quản lý toàn hệ
  // thống), với lý do tránh dội thông báo của mọi kho lẻ cho người chỉ
  // giám sát tổng thể — nhưng thực tế Admin cũng trực tiếp thao tác
  // chuyển/nhận kho (test, hỗ trợ IT...) nên VẪN cần thấy, đúng theo phản
  // hồi thực tế của user. getPendingIncomingTransfers/getRecentlyRejectedTransfers
  // tự xử lý đúng ý nghĩa "null = không giới hạn, thấy hết" (quy ước dùng
  // xuyên suốt hệ thống) nên chỉ cần truyền thẳng regionWarehouseIds, không
  // cần tự chặn ở đây nữa.
  const pendingTransfers = await getPendingIncomingTransfers(
    user.regionWarehouseIds
  );

  // Banner "to" cho kho NGUỒN khi 1 lượt chuyển đi bị kho đích từ chối —
  // trước đây chỉ có trong chuông thông báo (NotificationBell), user phản
  // hồi thực tế là dễ bỏ sót, cần nổi bật ngang hàng 2 banner ở trên. Cùng
  // lý do như banner luân chuyển phía trên — không chặn Admin không giới
  // hạn nữa, để null tự nghĩa là "thấy hết".
  const rejectedTransfers = (
    await getRecentlyRejectedTransfers(
      user.regionWarehouseIds,
      user.lastNotificationReadAt
    )
  ).map((item) => ({
    id: item.id,
    assetId: item.assetId,
    assetTag: item.assetTag,
    rejectingWarehouseLabel: item.rejectingWarehouse
      ? `${item.rejectingWarehouse.code} - ${item.rejectingWarehouse.name}`
      : null,
  }));

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-slate-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 overflow-hidden bg-gradient-to-b from-[#5B93F5] via-[#3E74E8] to-[#2C58C9] text-white">
        {/* Logo */}
        <div className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh
                  tĩnh nhỏ trong public/, không cần qua pipeline tối ưu ảnh
                  của Next (đỡ phụ thuộc "sharp" lúc chạy trong Docker image). */}
              <img
                src="/mascot-chicken-sm.png"
                alt="ITAMS mascot"
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <h1 className="text-lg font-bold leading-tight">ITAMS</h1>

              <p className="text-[11px] leading-4 text-blue-100">
                IT Asset Management
                <br />
                System
              </p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="mt-2 space-y-1 px-3">
          {canAccessMenu(roleName, "dashboard") && (
            <AppMenuLink
              href="/"
              icon={<Home size={18} />}
              label="Dashboard"
            />
          )}

          {canAccessMenu(roleName, "assets") && (
            <AppMenuLink
              href="/assets"
              icon={<Monitor size={18} />}
              label="Quản lý tài sản"
            />
          )}

          {canAccessMenu(roleName, "models") && (
            <AppMenuLink
              href="/models"
              icon={<BookOpen size={18} />}
              label="Model Library"
            />
          )}

          {canAccessMenu(roleName, "supplies") && (
            <AppMenuLink
              href="/supplies"
              icon={<Package size={18} />}
              label="Vật tư"
            />
          )}

          {canAccessMenu(roleName, "employees") && (
            <AppMenuLink
              href="/employees"
              icon={<Users size={18} />}
              label="Quản lý nhân viên"
            />
          )}

          {canAccessMenu(roleName, "reports") && (
            <AppMenuLink
              href="/reports"
              icon={<FileBarChart size={18} />}
              label="Báo cáo"
            />
          )}

          {canAccessMenu(roleName, "users") && (
            <AppMenuLink
              href="/users"
              icon={<ShieldUser size={18} />}
              label="Quản lý tài khoản"
            />
          )}

          {canAccessMenu(roleName, "settings") && (
            <AppMenuLink
              href="/settings"
              icon={<Settings size={18} />}
              label="Cài đặt"
            />
          )}
        </nav>

        {/* User Card */}
        <div className="absolute bottom-4 left-3 right-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900">
                {user.fullName.charAt(0)}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.fullName}</p>

                <span className="mt-1 inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-medium text-white">
                  {user.role.name}
                </span>
              </div>
            </div>

            <Link
              href="/change-password"
              className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-blue-100 transition hover:bg-white/10"
            >
              <KeyRound size={16} />
              Đổi mật khẩu
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Content */}
      <section className="ml-64 min-h-screen">
        {/* Banner cố định, không tự đóng được — cố tình KHÔNG có nút "x" để
            không thể lỡ bấm ẩn đi rồi quên mất, vẫn thấy ở mọi trang cho tới
            khi thực sự bấm vào xử lý (Gia hạn sửa chữa/Sửa xong/Không sửa
            được), làm mất luôn điều kiện needsFollowUp thì banner mới tự hết.
            Đặt TRÊN topbar (kể cả các trang hideTopbar như Dashboard) để
            không trang nào lọt lưới. */}
        {needsFollowUpAssets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-6 py-3">
            <div className="flex items-center gap-2.5 text-rose-700">
              <TriangleAlert size={18} className="shrink-0" />
              <p className="text-sm font-semibold">
                Có {needsFollowUpAssets.length} thiết bị sửa chữa/bảo hành quá
                hạn cần bạn cập nhật hướng xử lý.
              </p>
            </div>

            <Link
              href="/assets/warranty"
              className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
            >
              Cập nhật ngay
            </Link>
          </div>
        )}

        {/* Banner riêng cho lượt luân chuyển kho đang chờ xác nhận — tách
            khỏi banner hướng xử lý ở trên vì áp dụng cho đối tượng khác
            (theo phạm vi kho, không theo role) và trỏ tới trang khác
            (/assets/transfers). Cả 2 banner có thể cùng hiện song song nếu
            tài khoản vừa có thiết bị sửa chữa quá hạn vừa có lượt luân
            chuyển chờ xác nhận — không loại trừ nhau. */}
        {pendingTransfers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200 bg-violet-50 px-6 py-3">
            <div className="flex items-center gap-2.5 text-violet-700">
              <Truck size={18} className="shrink-0" />
              <p className="text-sm font-semibold">
                Có {pendingTransfers.length} thiết bị đang chuyển đến kho bạn,
                cần xác nhận nhập kho.
              </p>
            </div>

            <Link
              href="/assets/transfers"
              className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700"
            >
              Xác nhận ngay
            </Link>
          </div>
        )}

        {/* Banner "to" cho kho nguồn khi lượt chuyển đi bị từ chối — xem
            RejectedTransferBanner.tsx và getRecentlyRejectedTransfers
            (asset.service.ts). Tự ẩn khi user bấm "Đã xem" (đánh dấu đã đọc
            chuông thông báo), không cần thêm field/migration riêng. */}
        <RejectedTransferBanner items={rejectedTransfers} />

        {!hideTopbar && <AppTopbar bell={<NotificationBell />} />}

        <div className="p-6">{children}</div>
      </section>
    </main>
  );
}