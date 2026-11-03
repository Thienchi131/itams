"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import type { SystemHealth } from "@/modules/system/system-health.service";

const POLL_INTERVAL_MS = 5000;

function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  parts.push(`${minutes} phút`);
  return parts.join(" ");
}

function usageColor(percent: number) {
  if (percent >= 90) return "bg-rose-500";
  if (percent >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function UsageBar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{detail}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${usageColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default function SystemHealthLive({ initial }: { initial: SystemHealth }) {
  const [health, setHealth] = useState<SystemHealth>(initial);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date(initial.measuredAt));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/system-health", { cache: "no-store" });
        if (!res.ok) throw new Error("Không lấy được số liệu");
        const data: SystemHealth = await res.json();
        if (!cancelled) {
          setHealth(data);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Mất kết nối tới server — đang thử lại...");
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Activity size={16} className="text-emerald-500" />
          {error ?? "Tự động cập nhật mỗi 5 giây"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <RefreshCw size={14} />
          Cập nhật lúc {lastUpdated.toLocaleTimeString("vi-VN")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <UsageBar
          label="CPU Load (1 phút)"
          percent={(health.loadAvg1 / health.cpuCores) * 100}
          detail={`${health.loadAvg1.toFixed(2)} / ${health.cpuCores} nhân`}
        />
        <UsageBar
          label="RAM"
          percent={health.memUsagePercent}
          detail={`${formatBytes(health.usedMemBytes)} / ${formatBytes(health.totalMemBytes)}`}
        />
        <UsageBar
          label="Ổ đĩa"
          percent={health.diskUsagePercent}
          detail={`${formatBytes(health.diskUsedBytes)} / ${formatBytes(health.diskTotalBytes)}`}
        />
        {health.swapTotalBytes > 0 ? (
          <UsageBar
            label="Swap"
            percent={health.swapUsagePercent}
            detail={`${formatBytes(health.swapUsedBytes)} / ${formatBytes(health.swapTotalBytes)}`}
          />
        ) : (
          <div>
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Swap</div>
            <div className="text-sm text-slate-400">Chưa cấu hình swap trên VPS</div>
          </div>
        )}
        <div>
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Load average</div>
          <div className="flex gap-4 text-sm text-slate-600">
            <span>1 phút: <b className="text-slate-900">{health.loadAvg1.toFixed(2)}</b></span>
            <span>5 phút: <b className="text-slate-900">{health.loadAvg5.toFixed(2)}</b></span>
            <span>15 phút: <b className="text-slate-900">{health.loadAvg15.toFixed(2)}</b></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-5">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">VPS Uptime</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{formatUptime(health.uptimeSeconds)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">App Uptime</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{formatUptime(health.processUptimeSeconds)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">RAM còn trống</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{formatBytes(health.freeMemBytes)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">Ổ đĩa còn trống</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{formatBytes(health.diskFreeBytes)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">Swap còn trống</div>
          <div className="mt-1 text-sm font-bold text-slate-900">
            {health.swapTotalBytes > 0 ? formatBytes(health.swapFreeBytes) : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
