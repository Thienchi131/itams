"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, assertWarehouseScope } from "@/modules/auth/auth.service";
import { AssetStatus, HistoryAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type LiquidationActionState = { error?: string; success?: string } | null;

// Xác nhận 1 thiết bị đang "Chờ thanh lý" (status=RETIRED, liquidatedAt còn
// null) đã thực sự được xử lý xong (bán/huỷ) — chuyển sang "Đã thanh lý"
// bằng cách set liquidatedAt. Không đổi status (vẫn RETIRED) vì thiết bị vẫn
// nên được coi là ngoài luồng hoạt động dù đang chờ hay đã xử lý xong.
//
// Ghi lại đầy đủ Serial Number, thời điểm xử lý và người xử lý vào
// AssetHistory (không dùng AuditLog — theo quy ước sẵn có của dự án, thao
// tác trên tài sản dùng AssetHistory làm log chính vì gắn trực tiếp với
// thiết bị và không bị xoá cùng lúc như trường hợp xoá tài sản).
export async function confirmLiquidationAction(
  _prevState: LiquidationActionState,
  formData: FormData
): Promise<LiquidationActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    return { error: "Thiết bị không tồn tại hoặc đã bị xoá." };
  }

  assertWarehouseScope(currentUser, asset.warehouseId);

  if (asset.status !== AssetStatus.RETIRED) {
    return {
      error: "Chỉ có thể xác nhận đã thanh lý cho thiết bị đang ở trạng thái Chờ thanh lý.",
    };
  }

  if (asset.liquidatedAt) {
    return { error: "Thiết bị này đã được xác nhận thanh lý trước đó." };
  }

  const liquidatedAt = new Date();

  await prisma.asset.update({
    where: { id: assetId },
    data: { liquidatedAt, liquidatedBy: currentUser.fullName },
  });

  // Cố tình dùng HistoryAction.UPDATE (không phải RETIRE) — getAssetsRetired
  // lấy "lịch sử RETIRE mới nhất" để hiện lý do/người ĐÁNH DẤU chờ thanh lý
  // ban đầu; nếu dòng xác nhận này cũng gắn action=RETIRE, nó sẽ bị coi là
  // "mới nhất" và ghi đè mất thông tin gốc trên bảng Chờ thanh lý. Người/ngày
  // xác nhận đã lưu riêng trên chính Asset (liquidatedBy/liquidatedAt) nên
  // không cần đọc lại từ dòng lịch sử này.
  await prisma.assetHistory.create({
    data: {
      assetId,
      action: HistoryAction.UPDATE,
      fromWarehouseId: asset.warehouseId,
      toWarehouseId: asset.warehouseId,
      note: `Đã thanh lý — SN: ${asset.serialNumber}`,
      createdBy: currentUser.fullName,
    },
  });

  // Ở lại trang Kho thanh lý (không redirect) — chỉ cần làm mới data để máy
  // vừa xác nhận chuyển từ tab Chờ sang tab Đã thanh lý ngay lập tức.
  revalidatePath("/assets/liquidation");
  return { success: "Đã xác nhận thanh lý." };
}

// ---------------------------------------------------------------------------
// Thêm hàng loạt thiết bị vào Chờ thanh lý
// ---------------------------------------------------------------------------
//
// Luồng 2 bước từ BulkRetireModal:
//   1. previewBulkRetireAction(rawCodes) — người dùng dán danh sách Asset Tag
//      hoặc Serial (mỗi dòng 1 mã, hoặc copy nguyên cột từ Excel). Server tra
//      cứu và phân loại từng mã: hợp lệ / không hợp lệ (kèm lý do) để người
//      dùng xem trước, KHÔNG ghi gì vào DB.
//   2. bulkRetireAction — nhận danh sách assetId hợp lệ + lý do chung, kiểm
//      tra lại lần nữa (dữ liệu có thể đã đổi giữa 2 bước) rồi chuyển tất cả
//      sang RETIRED trong 1 transaction.
//
// Chỉ nhận thiết bị đang Trong kho (IN_STOCK) hoặc Bảo trì (REPAIR) — đúng 2
// điểm vào Chờ thanh lý đang có ở bản đơn lẻ (sendToRepairAction và
// completeRepairAction UNFIXABLE). Máy đang cấp phát phải Thu hồi trước;
// máy đang luân chuyển kho phải chờ xác nhận/từ chối xong.

const BULK_RETIRE_MAX = 1000;

const BULK_RETIRE_ALLOWED: AssetStatus[] = [AssetStatus.IN_STOCK, AssetStatus.REPAIR];

const BULK_RETIRE_REJECT_REASON: Partial<Record<AssetStatus, string>> = {
  [AssetStatus.ASSIGNED]: "Đang cấp phát cho nhân viên — cần thu hồi trước",
  [AssetStatus.RETIRED]: "Đã nằm trong Kho thanh lý",
  [AssetStatus.LOST]: "Đang ở trạng thái Thất lạc",
  [AssetStatus.IN_TRANSIT]: "Đang luân chuyển kho — chờ kho đích xác nhận",
};

export type BulkRetirePreviewRow = {
  code: string;
  ok: boolean;
  reason?: string;
  asset?: {
    id: number;
    assetTag: string;
    serialNumber: string;
    model: string;
    warehouse: string;
    status: AssetStatus;
  };
};

export type BulkRetirePreviewResult =
  | { error: string }
  | { rows: BulkRetirePreviewRow[] };

function parseCodes(raw: string) {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const code = part.trim();
    if (!code) continue;
    const key = code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    codes.push(code);
  }
  return codes;
}

export async function previewBulkRetireAction(
  rawCodes: string
): Promise<BulkRetirePreviewResult> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const codes = parseCodes(String(rawCodes ?? ""));

  if (codes.length === 0) {
    return { error: "Vui lòng nhập ít nhất 1 Asset Tag hoặc Serial." };
  }

  if (codes.length > BULK_RETIRE_MAX) {
    return {
      error: `Tối đa ${BULK_RETIRE_MAX} mã mỗi lần (đang có ${codes.length}). Vui lòng chia nhỏ danh sách.`,
    };
  }

  const assets = await prisma.asset.findMany({
    where: {
      OR: [
        { assetTag: { in: codes, mode: "insensitive" } },
        { serialNumber: { in: codes, mode: "insensitive" } },
      ],
    },
    include: { model: true, warehouse: true },
  });

  const byCode = new Map<string, (typeof assets)[number]>();
  for (const asset of assets) {
    byCode.set(asset.assetTag.toUpperCase(), asset);
    byCode.set(asset.serialNumber.toUpperCase(), asset);
  }

  // 1 máy có thể bị dán 2 lần (1 lần bằng Tag, 1 lần bằng Serial) — chỉ nhận
  // lần đầu, các lần sau báo trùng.
  const usedAssetIds = new Set<number>();

  const rows: BulkRetirePreviewRow[] = codes.map((code) => {
    const asset = byCode.get(code.toUpperCase());

    if (!asset) {
      return { code, ok: false, reason: "Không tìm thấy Asset Tag / Serial" };
    }

    const info = {
      id: asset.id,
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      model: `${asset.model.brand} ${asset.model.modelName}`,
      warehouse: asset.warehouse
        ? `${asset.warehouse.code} - ${asset.warehouse.name}`
        : "-",
      status: asset.status,
    };

    if (usedAssetIds.has(asset.id)) {
      return { code, ok: false, reason: "Trùng thiết bị đã có trong danh sách", asset: info };
    }
    usedAssetIds.add(asset.id);

    if (
      currentUser.regionWarehouseIds &&
      (asset.warehouseId === null ||
        !currentUser.regionWarehouseIds.includes(asset.warehouseId))
    ) {
      return {
        code,
        ok: false,
        reason: "Thuộc kho ngoài khu vực bạn được phân quyền",
        asset: info,
      };
    }

    if (!BULK_RETIRE_ALLOWED.includes(asset.status)) {
      return {
        code,
        ok: false,
        reason: BULK_RETIRE_REJECT_REASON[asset.status] ?? "Trạng thái không hợp lệ",
        asset: info,
      };
    }

    return { code, ok: true, asset: info };
  });

  return { rows };
}

export type BulkRetireActionState =
  | { error: string }
  | { success: true; count: number; skipped: number }
  | null;

export async function bulkRetireAction(
  _prevState: BulkRetireActionState,
  formData: FormData
): Promise<BulkRetireActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const reason = String(formData.get("reason") || "").trim();
  const assetIds = [
    ...new Set(
      String(formData.get("assetIds") || "")
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];

  if (!reason) {
    return { error: "Vui lòng nhập lý do thanh lý." };
  }

  if (assetIds.length === 0) {
    return { error: "Không có thiết bị hợp lệ nào để chuyển." };
  }

  if (assetIds.length > BULK_RETIRE_MAX) {
    return { error: `Tối đa ${BULK_RETIRE_MAX} thiết bị mỗi lần.` };
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
  });

  // Kiểm tra lại y hệt bước xem trước — bỏ qua (không báo lỗi cả lô) những
  // máy đã đổi trạng thái/kho trong lúc người dùng đang xem trước.
  const eligible = assets.filter(
    (asset) =>
      BULK_RETIRE_ALLOWED.includes(asset.status) &&
      (!currentUser.regionWarehouseIds ||
        (asset.warehouseId !== null &&
          currentUser.regionWarehouseIds.includes(asset.warehouseId)))
  );

  if (eligible.length === 0) {
    return {
      error:
        "Không có thiết bị nào được chuyển — dữ liệu đã thay đổi, vui lòng kiểm tra lại danh sách.",
    };
  }

  // Cùng format condition/note với bản đơn lẻ (sendToRepairAction /
  // completeRepairAction) để getAssetsRetired() và Timeline hiển thị nhất
  // quán. Ghi HistoryAction.RETIRE để cột "Lý do thanh lý"/"Người đánh dấu"
  // trên trang này đọc đúng.
  await prisma.$transaction([
    ...eligible.map((asset) =>
      prisma.asset.update({
        where: { id: asset.id },
        data: {
          status: AssetStatus.RETIRED,
          condition: `Chờ thanh lý: ${reason}`,
        },
      })
    ),
    prisma.assetHistory.createMany({
      data: eligible.map((asset) => ({
        assetId: asset.id,
        action: HistoryAction.RETIRE,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: asset.warehouseId,
        note:
          asset.status === AssetStatus.REPAIR
            ? `Chờ thanh lý (hàng loạt, từ Bảo trì) — ${reason}`
            : `Chờ thanh lý (hàng loạt) — ${reason}`,
        createdBy: currentUser.fullName,
      })),
    }),
  ]);

  revalidatePath("/assets/liquidation");
  revalidatePath("/assets");
  revalidatePath("/");

  return {
    success: true,
    count: eligible.length,
    skipped: assetIds.length - eligible.length,
  };
}
