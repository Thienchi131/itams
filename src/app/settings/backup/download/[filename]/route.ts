import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { requireRole } from "@/modules/auth/auth.service";
import { resolveBackupPath } from "@/modules/backup/backup.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  await requireRole(["Admin"]);

  const { filename } = await params;

  let filePath: string;
  try {
    filePath = resolveBackupPath(decodeURIComponent(filename));
  } catch {
    return new Response("File backup không hợp lệ.", { status: 400 });
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Không tìm thấy file backup.", { status: 404 });
  }

  const webStream = Readable.toWeb(
    createReadStream(filePath)
  ) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(size),
    },
  });
}
