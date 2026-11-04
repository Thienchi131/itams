"use server";

import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";

export type ScanMatch = {
  id: number;
  assetTag: string;
  serialNumber: string | null;
  label: string;
  warehouse: string | null;
};

export type ScanLookupResult =
  | { assetId: number }
  | { matches: ScanMatch[] }
  | { error: string };

// Tra thiết bị từ nội dung vừa quét / gõ tay. Chấp nhận:
//  - QR do ITAMS in: link ".../assets/<id>"
//  - Asset Tag (IT-ddmmyy-xxxxxxx)
//  - Serial — kể cả mã vạch trên hộp Apple có tiền tố "S" trước serial
// Khớp chính xác 1 máy -> trả assetId để mở thẳng; nhiều/khớp gần đúng ->
// trả danh sách để chọn. Phạm vi kho áp như trang danh sách tài sản (trang
// chi tiết vẫn tự kiểm tra lại).
export async function lookupScannedCodeAction(raw: string): Promise<ScanLookupResult> {
  const currentUser = await requireLogin();
  const code = String(raw || "").trim();

  if (!code) return { error: "Chưa có mã để tra." };
  if (code.length > 200) return { error: "Mã quá dài, không phải mã thiết bị." };

  const scope = currentUser.regionWarehouseIds
    ? {
        OR: [
          { warehouseId: { in: currentUser.regionWarehouseIds } },
          { pendingTransferToWarehouseId: { in: currentUser.regionWarehouseIds } },
        ],
      }
    : {};

  const urlMatch = code.match(/\/assets\/(\d+)(?:[/?#]|$)/);
  if (urlMatch) {
    const asset = await prisma.asset.findFirst({
      where: { id: Number(urlMatch[1]), ...scope },
      select: { id: true },
    });
    return asset
      ? { assetId: asset.id }
      : { error: "Không tìm thấy thiết bị này, hoặc thiết bị nằm ngoài kho bạn được phân quyền." };
  }

  const normalized = code.toUpperCase();
  const candidates = [normalized];
  // Mã vạch serial trên hộp Apple in dạng "S" + serial.
  if (/^S[A-Z0-9]{10,14}$/.test(normalized)) candidates.push(normalized.slice(1));

  const select = {
    id: true,
    assetTag: true,
    serialNumber: true,
    model: { select: { brand: true, modelName: true } },
    warehouse: { select: { code: true, name: true } },
  } as const;

  const exact = await prisma.asset.findMany({
    where: {
      ...scope,
      OR: candidates.flatMap((c) => [
        { assetTag: { equals: c, mode: "insensitive" as const } },
        { serialNumber: { equals: c, mode: "insensitive" as const } },
      ]),
    },
    select,
    take: 10,
  });

  if (exact.length === 1) return { assetId: exact[0].id };

  const rows =
    exact.length > 1
      ? exact
      : await prisma.asset.findMany({
          where: {
            ...scope,
            OR: [
              { assetTag: { contains: normalized, mode: "insensitive" } },
              { serialNumber: { contains: normalized, mode: "insensitive" } },
            ],
          },
          select,
          take: 10,
        });

  if (rows.length === 0) {
    return { error: `Không tìm thấy thiết bị nào khớp "${code}".` };
  }

  return {
    matches: rows.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      serialNumber: a.serialNumber,
      label: `${a.model.brand} ${a.model.modelName}`,
      warehouse: a.warehouse ? `${a.warehouse.code} - ${a.warehouse.name}` : null,
    })),
  };
}
