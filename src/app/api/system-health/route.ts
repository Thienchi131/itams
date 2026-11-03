import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/auth.service";
import { getSystemHealth } from "@/modules/system/system-health.service";

// Dùng để trang /settings/system-health poll định kỳ lấy số liệu tải thực
// tế (CPU load, RAM, disk, uptime) — chỉ Admin được gọi.
export async function GET() {
  await requireRole(["Admin"]);
  const health = getSystemHealth();
  return NextResponse.json(health);
}
