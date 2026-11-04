import AppLayout from "../components/AppLayout";
import Link from "next/link";
import {
  Database,
  Warehouse,
  Wrench,
  MapPin,
  PackageCheck,
  ShieldCheck,
  UploadCloud,
  KeyRound,
  ClipboardList,
  Activity,
  Tags,
} from "lucide-react";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";

// Cả trang chỉ dành cho Admin — trước đây IT cũng vào được nhưng hầu hết
// card bên trong đã bị khoá riêng cho Admin rồi (Kho, Khu vực, Phiếu nhập
// kho, Whitelist IP), nay chặn thẳng từ đầu cho gọn, khớp với menu sidebar
// (xem MENU_ACCESS.settings trong permissions.ts).
export default async function SettingsPage() {
  await requireRole([ROLE_ADMIN]);

  return (
    <AppLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Cài đặt</h2>
        <p className="mt-1 text-slate-500">
          Cấu hình hệ thống IT Asset Management
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <SettingCard
          icon={<Warehouse />}
          title="Kho"
          desc="Quản lý warehouse và location"
          href="/settings/warehouses"
        />
        <SettingCard
          icon={<MapPin />}
          title="Khu vực"
          desc="Nhóm nhiều kho để gán phân quyền xem"
          href="/settings/regions"
        />
        <SettingCard
          icon={<PackageCheck />}
          title="Phiếu nhập kho"
          desc="Xem toàn bộ phiếu nhập (tay + Import Excel), xoá phiếu lỗi"
          href="/settings/stock-in-slips"
        />
        <SettingCard
          icon={<ShieldCheck />}
          title="Whitelist IP"
          desc="Chỉ cho phép IP trong danh sách truy cập toàn hệ thống"
          href="/settings/ip-whitelist"
        />
        <SettingCard
          icon={<UploadCloud />}
          title="Import Excel"
          desc="Bật/tắt tính năng import tài sản từ file Excel"
          href="/settings/import"
        />
        <SettingCard
          icon={<KeyRound />}
          title="Nhật ký đăng nhập"
          desc="Lịch sử mọi lượt đăng nhập thành công/thất bại"
          href="/settings/login-log"
        />
        <SettingCard
          icon={<ClipboardList />}
          title="Nhật ký thao tác"
          desc="Audit log các thao tác nhạy cảm: tài khoản, whitelist IP, gộp/xoá Model..."
          href="/settings/audit-log"
        />
        <SettingCard
          icon={<Activity />}
          title="Sức khoẻ VPS"
          desc="Thông số phần cứng (CPU, RAM, ổ đĩa) và tải thực tế theo thời gian thực"
          href="/settings/system-health"
        />
        <SettingCard
          icon={<Wrench />}
          title="Theo dõi sửa chữa"
          desc="Thiết bị đang thu hồi để sửa chữa/bảo hành"
          href="/assets/warranty"
        />
        <SettingCard
          icon={<Database />}
          title="Backup & Restore"
          desc="Sao lưu và khôi phục toàn bộ database PostgreSQL"
          href="/settings/backup"
        />
        <SettingCard
          icon={<Tags />}
          title="Tag Model"
          desc="Gắn tag 🆗 Cấp phát được / 🅱️ Backup cho từng model, hiển thị ở bảng Quản lý tài sản"
          href="/settings/model-tags"
        />
      </div>
    </AppLayout>
  );
}

function SettingCard({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
        {icon}
      </div>

      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>

      <Link
        href={href}
        className="mt-5 inline-block rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
      >
        Cấu hình
      </Link>
    </div>
  );
}