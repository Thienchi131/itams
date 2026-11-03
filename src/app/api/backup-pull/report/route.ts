import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Endpoint để MÁY BACKUP NGOÀI (VD: Mac ở nhà/văn phòng, xem
// scripts/backup-pull-to-mac.sh) tự báo cáo kết quả mỗi lần nó kéo file
// backup về — không phải người dùng đăng nhập nên không dùng
// requireLogin()/requireRole() như các route khác, mà xác thực bằng 1 token
// bí mật riêng (BACKUP_PULL_REPORT_TOKEN trong .env, xem
// .env.production.example) gửi qua header Authorization.
function isValidToken(request: NextRequest): boolean {
  const expected = process.env.BACKUP_PULL_REPORT_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!provided) return false;

  // So sánh timing-safe — cùng lý do như verifySession() trong
  // src/lib/session.ts: tránh lộ thông tin qua thời gian phản hồi khi so
  // khớp token dài.
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: NextRequest) {
  if (!isValidToken(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;

  const source =
    typeof data.source === "string" && data.source.trim()
      ? data.source.trim().slice(0, 100)
      : "Không rõ nguồn";

  const status = data.status === "success" ? "success" : "error";

  const fileCount =
    typeof data.fileCount === "number" && Number.isFinite(data.fileCount)
      ? Math.trunc(data.fileCount)
      : null;

  const message =
    typeof data.message === "string" ? data.message.slice(0, 2000) : null;

  await prisma.backupPullLog.create({
    data: { source, status, fileCount, message },
  });

  return NextResponse.json({ ok: true });
}
