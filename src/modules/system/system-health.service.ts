import os from "node:os";
import fs from "node:fs";

/**
 * Thông số sức khoẻ VPS — đọc trực tiếp từ kernel (module `os` của Node) và
 * hệ thống file (`fs.statfsSync`), KHÔNG cần agent/tool cài thêm trên VPS.
 *
 * Lưu ý quan trọng về độ chính xác khi app chạy trong Docker container:
 * - CPU (model, số nhân), RAM (tổng/còn trống) và load average: mặc định
 *   Docker KHÔNG cô lập các file /proc/cpuinfo, /proc/meminfo, /proc/loadavg
 *   theo từng container (trừ khi VPS có giới hạn cgroup rất chặt) — nên các
 *   số liệu này gần như phản ánh đúng toàn bộ VPS (host), không phải riêng
 *   container.
 * - Dung lượng ổ đĩa: dùng statfs trên "/" bên trong container, thực chất là
 *   phân vùng chứa Docker (overlay2) trên VPS — vì toàn bộ dữ liệu quan
 *   trọng (DB) nằm ở volume Docker trên cùng ổ đĩa này nên số liệu vẫn phản
 *   ánh đúng tình trạng "còn bao nhiêu chỗ trống" cần quan tâm, nhưng có thể
 *   lệch một chút so với `df -h` chạy trực tiếp trên VPS nếu VPS có nhiều ổ/
 *   phân vùng tách rời.
 */

export type SystemHealth = {
  hostname: string;
  platform: string;
  arch: string;
  kernelRelease: string;
  nodeVersion: string;
  cpuModel: string;
  cpuCores: number;
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  memUsagePercent: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  uptimeSeconds: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskUsedBytes: number;
  diskUsagePercent: number;
  swapTotalBytes: number;
  swapFreeBytes: number;
  swapUsedBytes: number;
  swapUsagePercent: number;
  processUptimeSeconds: number;
  measuredAt: string;
};

// os module của Node KHÔNG có API đọc dung lượng swap — phải đọc trực tiếp
// /proc/meminfo (chỉ có trên Linux, đúng môi trường VPS đang chạy). Cũng
// không bị cô lập theo container (giống /proc/meminfo, /proc/loadavg khác),
// nên phản ánh đúng swap thật của toàn VPS chứ không phải riêng container.
function readSwapInfo(): { totalBytes: number; freeBytes: number } {
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const totalMatch = meminfo.match(/^SwapTotal:\s+(\d+) kB/m);
    const freeMatch = meminfo.match(/^SwapFree:\s+(\d+) kB/m);
    const totalBytes = totalMatch ? Number(totalMatch[1]) * 1024 : 0;
    const freeBytes = freeMatch ? Number(freeMatch[1]) * 1024 : 0;
    return { totalBytes, freeBytes };
  } catch {
    // Không phải Linux, hoặc không đọc được /proc/meminfo — coi như không có swap.
    return { totalBytes: 0, freeBytes: 0 };
  }
}

export function getSystemHealth(): SystemHealth {
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();
  const usedMemBytes = totalMemBytes - freeMemBytes;
  const memUsagePercent = totalMemBytes > 0 ? (usedMemBytes / totalMemBytes) * 100 : 0;

  const [loadAvg1, loadAvg5, loadAvg15] = os.loadavg();

  const cpus = os.cpus();

  let diskTotalBytes = 0;
  let diskFreeBytes = 0;
  let diskUsedBytes = 0;
  let diskUsagePercent = 0;
  try {
    // fs.statfsSync có từ Node 18.15 / 19.6 trở lên — image dùng node:20 nên luôn có.
    const stat = fs.statfsSync("/");
    diskTotalBytes = stat.blocks * stat.bsize;
    diskFreeBytes = stat.bavail * stat.bsize;
    diskUsedBytes = diskTotalBytes - diskFreeBytes;
    diskUsagePercent = diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0;
  } catch {
    // Giữ nguyên giá trị 0 nếu môi trường không hỗ trợ statfs — không chặn phần còn lại.
  }

  const swap = readSwapInfo();
  const swapUsedBytes = swap.totalBytes - swap.freeBytes;
  const swapUsagePercent = swap.totalBytes > 0 ? (swapUsedBytes / swap.totalBytes) * 100 : 0;

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    kernelRelease: os.release(),
    nodeVersion: process.version,
    cpuModel: cpus[0]?.model?.trim() ?? "Không xác định",
    cpuCores: cpus.length,
    totalMemBytes,
    freeMemBytes,
    usedMemBytes,
    memUsagePercent,
    loadAvg1,
    loadAvg5,
    loadAvg15,
    uptimeSeconds: os.uptime(),
    diskTotalBytes,
    diskFreeBytes,
    diskUsedBytes,
    diskUsagePercent,
    swapTotalBytes: swap.totalBytes,
    swapFreeBytes: swap.freeBytes,
    swapUsedBytes,
    swapUsagePercent,
    processUptimeSeconds: process.uptime(),
    measuredAt: new Date().toISOString(),
  };
}
