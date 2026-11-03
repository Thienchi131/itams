import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth.service";
import { getSystemHealth } from "@/modules/system/system-health.service";
import SystemHealthLive from "./SystemHealthLive";
import { ArrowLeft, Server, Cpu, MemoryStick, HardDrive } from "lucide-react";

export default async function SystemHealthPage() {
  await requireRole(["Admin"]);

  const health = getSystemHealth();

  return (
    <AppLayout>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Cài đặt
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Sức khoẻ VPS</h2>
        <p className="mt-1 text-sm text-slate-500">
          Thông số phần cứng và tải thực tế của server đang chạy ITAMS
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SpecCard icon={<Server />} label="Hostname" value={health.hostname} sub={`${health.platform} · ${health.kernelRelease}`} />
        <SpecCard icon={<Cpu />} label="CPU" value={`${health.cpuCores} nhân`} sub={health.cpuModel} />
        <SpecCard icon={<MemoryStick />} label="Tổng RAM" value={`${(health.totalMemBytes / 1024 ** 3).toFixed(1)} GB`} sub="Vật lý" />
        <SpecCard icon={<HardDrive />} label="Tổng ổ đĩa" value={`${(health.diskTotalBytes / 1024 ** 3).toFixed(1)} GB`} sub="Phân vùng chứa Docker" />
      </div>

      <SystemHealthLive initial={health} />

      <p className="mt-4 text-xs text-slate-400">
        Ghi chú: CPU/RAM/Load lấy trực tiếp từ nhân hệ điều hành nên phản ánh
        đúng toàn bộ VPS. Riêng dung lượng ổ đĩa đo trên phân vùng chứa
        Docker — nếu VPS có nhiều ổ/phân vùng tách rời, số liệu này chỉ đúng
        cho phân vùng đó.
      </p>
    </AppLayout>
  );
}

function SpecCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
        {icon}
      </div>
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-lg font-bold text-slate-900" title={value}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-slate-500" title={sub}>
        {sub}
      </div>
    </div>
  );
}
