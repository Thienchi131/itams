"use server";

import { prisma } from "@/lib/prisma";
import { generateUniqueAssetTag } from "@/modules/asset/asset-tag";
import { AssetStatus, HistoryAction, StockInType } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireRole, assertWarehouseScope } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import { STOCK_IN_TYPE_LABEL } from "@/modules/asset/asset.helpers";
import { withFlash } from "@/lib/flash";

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Khớp đúng 3 lựa chọn ở dropdown "Lý do thu hồi" trong StockInForm.tsx —
// chỉ lưu nhãn tiếng Việt vào AssetHistory.note (không thêm cột DB riêng cho
// lý do vì đây chỉ là 1 dòng mô tả bối cảnh, không cần lọc/thống kê riêng).
const RETURN_REASON_LABELS: Record<string, string> = {
  MAINTENANCE: "Bảo trì/bảo hành",
  TRANSFER: "Luân chuyển",
  RESIGNED: "Nghỉ việc",
};

/**
 * Kiểm tra trùng Serial Number — dùng cho preview ngay trong form (gọi từ
 * client trước khi submit) lẫn validate chặn thật ở createStockInAction.
 * Trả về 2 danh sách riêng: serial bị lặp NGAY TRONG những dòng vừa nhập,
 * và serial đã tồn tại sẵn trong hệ thống (thiết bị khác đã dùng rồi).
 */
async function findDuplicateSerials(serialNumbers: string[]) {
  const seen = new Set<string>();
  const duplicatedInInput = new Set<string>();

  for (const serial of serialNumbers) {
    const key = serial.trim().toLowerCase();
    if (!key) continue;

    if (seen.has(key)) {
      duplicatedInInput.add(serial.trim());
    }

    seen.add(key);
  }

  const uniqueInput = [...new Set(serialNumbers.map((s) => s.trim()).filter(Boolean))];

  const existing = uniqueInput.length
    ? await prisma.asset.findMany({
        where: {
          OR: uniqueInput.map((serial) => ({
            serialNumber: { equals: serial, mode: "insensitive" as const },
          })),
        },
        select: { serialNumber: true },
      })
    : [];

  return {
    duplicatedInInput: [...duplicatedInInput],
    existingInSystem: existing.map((a) => a.serialNumber),
  };
}

/**
 * Server action gọi trực tiếp từ client (không qua <form>) để preview trùng
 * ngay khi user rời khỏi ô nhập Serial Number, trước khi họ bấm Lưu phiếu.
 */
export async function checkDuplicateSerialsAction(serialNumbers: string[]) {
  await requireRole([ROLE_ADMIN, ROLE_IT]);
  return findDuplicateSerials(serialNumbers);
}

type StockInLine = {
  modelId: number;
  serialNumbers: string[];
  hasAdapter: boolean;
  hasCable: boolean;
  // Tình trạng lúc nhập kho — DAMAGED nghĩa là máy về/thu hồi đã hỏng ngay,
  // cần chuyển thẳng sang trạng thái Bảo trì (REPAIR) thay vì Trong kho, để
  // không bị tính vào tồn kho khả dụng và hiện ở trang Theo dõi sửa chữa.
  condition: "GOOD" | "DAMAGED";
  damagedNote: string;
};

export type StockInState = { error: string } | null;

export async function createStockInAction(
  _prevState: StockInState,
  formData: FormData
): Promise<StockInState> {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const vendorName = String(formData.get("vendorName") || "").trim();
  const submittedWarehouseCode = String(formData.get("warehouseCode") || "").trim();

  // Trước đây field này bị bỏ qua, luôn hardcode NEW_PURCHASE dù radio
  // "Thu hồi" hiển thị có thể chọn — giờ đọc đúng giá trị user chọn.
  const stockInType =
    String(formData.get("stockInType") || "") === "RETURNED"
      ? StockInType.RETURNED
      : StockInType.NEW_PURCHASE;

  // Bảo hành chỉ áp dụng cho thiết bị MỚI (Thu hồi coi như hết/không còn bảo
  // hành mới) — user chọn số tháng (12/24/36), ngày hết hạn được HỆ THỐNG
  // tự tính = ngày nhập kho + số tháng, không cho tự gõ ngày để tránh nhập
  // sai/lệch với ngày nhập thật. Bỏ qua hoàn toàn nếu là Thu hồi, kể cả khi
  // client lỡ gửi kèm giá trị này.
  const warrantyMonthsRaw = String(formData.get("warrantyMonths") || "").trim();

  // Bắt buộc chọn thời hạn bảo hành khi nhập Thiết bị mới — chặn cả ở server
  // (không chỉ tin validate phía client) để tránh trường hợp gửi thẳng
  // request bỏ qua form.
  if (stockInType === StockInType.NEW_PURCHASE && !warrantyMonthsRaw) {
    return { error: "Vui lòng chọn thời hạn bảo hành cho thiết bị mới." };
  }

  const warrantyMonths =
    stockInType === StockInType.NEW_PURCHASE && warrantyMonthsRaw
      ? Number(warrantyMonthsRaw)
      : null;

  // Chỉ có ý nghĩa khi nhập kho dạng Thu hồi — ghi lại hiện trạng thiết bị
  // lúc thu về (trầy xước, chai pin, thiếu phụ kiện...) để IT theo dõi
  // trước khi cấp lại cho người khác.
  const conditionNote = String(formData.get("conditionNote") || "").trim();

  // Thu hồi từ ai + lý do — bắt buộc khi Thu hồi (chặn cả server, không chỉ
  // tin validate phía client), để mọi thiết bị nhập dạng Thu hồi đều có
  // nguồn gốc rõ ràng thay vì chỉ có ghi chú tình trạng chung chung.
  const returnedFromEmployeeIdRaw = String(
    formData.get("returnedFromEmployeeId") || ""
  ).trim();
  const returnReasonCode = String(formData.get("returnReason") || "").trim();

  if (stockInType === StockInType.RETURNED) {
    if (!returnedFromEmployeeIdRaw || !RETURN_REASON_LABELS[returnReasonCode]) {
      return {
        error: "Vui lòng chọn nhân viên đã thu hồi thiết bị và lý do thu hồi.",
      };
    }
  }

  const returnedFromEmployee =
    stockInType === StockInType.RETURNED
      ? await prisma.employee.findUnique({
          where: { id: Number(returnedFromEmployeeIdRaw) },
        })
      : null;

  if (stockInType === StockInType.RETURNED && !returnedFromEmployee) {
    return { error: "Nhân viên đã chọn ở mục Thu hồi từ ai không tồn tại." };
  }

  // 1 phiếu nhập có thể gồm NHIỀU model khác nhau (VD: lô hàng về vừa có
  // MacBook vừa có iPhone) — mỗi "dòng" tự chọn Model + phụ kiện + danh
  // sách Serial riêng, gửi lên dưới dạng JSON thay vì field cố định vì số
  // dòng thay đổi tuỳ user thêm/bớt.
  let rawLines: {
    modelId: string | number;
    serialNumbers: string[];
    hasAdapter: boolean;
    hasCable: boolean;
    condition?: string;
    damagedNote?: string;
  }[] = [];

  try {
    rawLines = JSON.parse(String(formData.get("linesJson") || "[]"));
  } catch {
    return { error: "Dữ liệu form không hợp lệ, vui lòng thử lại." };
  }

  const lines: StockInLine[] = rawLines
    .map((line) => ({
      modelId: Number(line.modelId),
      serialNumbers: (Array.isArray(line.serialNumbers) ? line.serialNumbers : [])
        .map((s) => String(s || "").trim().toUpperCase())
        .filter(Boolean),
      hasAdapter: Boolean(line.hasAdapter),
      hasCable: Boolean(line.hasCable),
      condition: (line.condition === "DAMAGED" ? "DAMAGED" : "GOOD") as
        | "GOOD"
        | "DAMAGED",
      damagedNote: String(line.damagedNote || "").trim(),
    }))
    .filter((line) => line.modelId && line.serialNumbers.length > 0);

  if (lines.length === 0) {
    return {
      error: "Vui lòng chọn ít nhất 1 Model và nhập Serial Number cho model đó.",
    };
  }

  if (!submittedWarehouseCode) {
    return { error: "Vui lòng chọn kho nhập" };
  }

  const allSerialNumbers = lines.flatMap((line) => line.serialNumbers);

  // Chặn trùng Serial Number TRƯỚC khi tạo bất kỳ gì (gộp chung tất cả các
  // dòng/model lại để kiểm tra 1 lượt) — vừa tránh lỗi crash giữa chừng do
  // vi phạm ràng buộc unique ở DB, vừa báo rõ serial nào bị trùng.
  const { duplicatedInInput, existingInSystem } = await findDuplicateSerials(
    allSerialNumbers
  );

  if (duplicatedInInput.length > 0 || existingInSystem.length > 0) {
    const parts: string[] = [];

    if (duplicatedInInput.length > 0) {
      parts.push(`Bị lặp trong danh sách vừa nhập: ${duplicatedInInput.join(", ")}`);
    }

    if (existingInSystem.length > 0) {
      parts.push(`Đã tồn tại trong hệ thống: ${existingInSystem.join(", ")}`);
    }

    return { error: `Phát hiện Serial Number trùng — ${parts.join(" | ")}` };
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { code: submittedWarehouseCode },
  });

  if (!warehouse) {
    return { error: "Kho không tồn tại" };
  }

  // IT bị gán Region chỉ được nhập vào 1 kho thuộc Region đó ở server —
  // không tin warehouseCode gửi từ client, tránh nhập nhầm/cố tình nhập lẫn
  // kho ngoài Region.
  assertWarehouseScope(currentUser, warehouse.id);

  const models = await prisma.assetModel.findMany({
    where: { id: { in: lines.map((line) => line.modelId) } },
  });

  const modelsById = new Map(models.map((model) => [model.id, model]));

  for (const line of lines) {
    if (!modelsById.has(line.modelId)) {
      return { error: "Có Model không tồn tại trong danh sách đã chọn." };
    }
  }

  // Dùng CHUNG đúng 1 mốc thời gian "ngày nhập kho" cho slip, purchaseDate
  // của từng asset, và làm mốc bắt đầu tính hạn bảo hành — tránh mỗi chỗ tự
  // gọi new Date() lệch nhau vài mili-giây rồi tính bảo hành sai lệch ngày.
  const stockInDate = new Date();
  const warrantyEndDate =
    warrantyMonths !== null ? addMonths(stockInDate, warrantyMonths) : null;

  // Bọc transaction: nếu có gì lỗi giữa chừng (VD: 2 user cùng nhập trùng
  // serial trong tích tắc, va chạm với ràng buộc unique) thì rollback sạch,
  // không để lại phiếu/thiết bị tạo dở dang.
  await prisma.$transaction(async (tx) => {
    const slip = await tx.stockInSlip.create({
      data: {
        slipNo: `PN-${Date.now()}`,
        stockInDate,
        stockInType,
        vendorName,
        warehouseId: warehouse.id,
        note: `Import ${allSerialNumbers.length} devices (${lines.length} model) from stock-in form`,
        createdBy: currentUser.fullName,
      },
    });

    const usedTags = new Set<string>();

    for (const line of lines) {
      const model = modelsById.get(line.modelId)!;
      const isDamaged = line.condition === "DAMAGED";

      // Tình trạng lúc nhập ưu tiên hơn ghi chú Thu hồi chung của cả phiếu —
      // dòng bị đánh dấu Hư hỏng thì dùng đúng mô tả hư hỏng của dòng đó.
      const conditionText = isDamaged
        ? line.damagedNote || "Hư hỏng lúc nhập kho"
        : stockInType === StockInType.RETURNED && conditionNote
        ? conditionNote
        : "Good";

      for (const serialNumber of line.serialNumbers) {
        const asset = await tx.asset.create({
          data: {
            assetTag: await generateUniqueAssetTag(tx, usedTags),
            serialNumber,
            modelId: model.id,
            actualCpu: model.defaultCpu,
            actualRam: model.defaultRam,
            actualStorage: model.defaultStorage,
            actualScreen: model.defaultScreen,
            actualGpu: model.defaultGpu,
            condition: conditionText,
            // Máy đánh dấu Hư hỏng lúc nhập chuyển thẳng vào Bảo trì (REPAIR)
            // thay vì Trong kho — không bị tính vào tồn kho khả dụng, và IT
            // theo dõi tiếp ở trang Theo dõi sửa chữa cho tới khi sửa xong.
            status: isDamaged ? AssetStatus.REPAIR : AssetStatus.IN_STOCK,
            warehouseId: warehouse.id,
            purchaseDate: stockInDate,
          },
        });

        await tx.stockInItem.create({
          data: {
            stockInSlipId: slip.id,
            assetId: asset.id,
          },
        });

        // Ghi lịch sử action=STOCK_IN ngay lúc tạo thiết bị — trước đây chỉ
        // có StockInSlip/StockInItem (không hiện trong Timeline của thiết
        // bị, vì Timeline chỉ đọc từ AssetHistory) ghi lại lô nhập, còn bản
        // thân từng thiết bị thì KHÔNG có dòng lịch sử nào cho biết nó được
        // tạo lúc nào/bởi ai, TRỪ KHI rơi vào 1 trong 2 case REPAIR/RETURN
        // ngay bên dưới. Hậu quả: thiết bị nhập kho bình thường (Mua mới,
        // tình trạng Good) mà sau đó có luân chuyển/bàn giao thì Timeline
        // hiện ra như thể "sinh ra" đúng ngay từ dòng luân chuyển/bàn giao
        // đầu tiên đó — trông như bị mất log, dù thực ra log tạo ban đầu
        // chưa từng được ghi. Thêm dòng này để mọi thiết bị luôn có ít nhất
        // 1 dòng "Nhập kho" làm mốc đầu Timeline, khớp với cách import Excel
        // đã làm từ trước (xem assets/import/actions.ts).
        await tx.assetHistory.create({
          data: {
            assetId: asset.id,
            action: HistoryAction.STOCK_IN,
            toWarehouseId: warehouse.id,
            note: `Nhập kho — ${STOCK_IN_TYPE_LABEL[stockInType]}${
              vendorName ? ` · NCC: ${vendorName}` : ""
            }`,
            createdBy: currentUser.fullName,
          },
        });

        // Ghi lịch sử action=REPAIR ngay lúc nhập để trang Theo dõi sửa chữa
        // (getAssetsInRepair) tính được daysInRepair/lý do/người gửi đúng
        // ngay từ đầu, thay vì phải chờ ai đó gửi sửa chữa thủ công sau.
        if (isDamaged) {
          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: HistoryAction.REPAIR,
              toWarehouseId: warehouse.id,
              note: line.damagedNote || "Hư hỏng ngay lúc nhập kho",
              createdBy: currentUser.fullName,
            },
          });
        }

        // Nhập dạng Thu hồi — ghi lại rõ nguồn gốc (thu hồi từ ai, lý do gì)
        // vào Timeline của thiết bị, để sau này tra lại vẫn biết máy này về
        // kho từ đâu thay vì chỉ thấy "Nhập kho" trống trơn. Tách riêng khỏi
        // history REPAIR ở trên — 1 thiết bị Thu hồi mà về luôn bị hư vẫn cần
        // đủ cả 2 dòng lịch sử (Thu hồi + Hư hỏng), không loại trừ nhau.
        if (stockInType === StockInType.RETURNED && returnedFromEmployee) {
          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: HistoryAction.RETURN,
              fromEmployeeId: returnedFromEmployee.id,
              toWarehouseId: warehouse.id,
              note: `Thu hồi từ ${returnedFromEmployee.fullName} (${
                returnedFromEmployee.employeeCode
              }) — Lý do: ${RETURN_REASON_LABELS[returnReasonCode]}${
                conditionNote ? ` · Ghi chú: ${conditionNote}` : ""
              }`,
              createdBy: currentUser.fullName,
            },
          });
        }

        if (warrantyEndDate) {
          await tx.assetWarranty.create({
            data: {
              assetId: asset.id,
              provider: vendorName || null,
              startDate: stockInDate,
              endDate: warrantyEndDate,
            },
          });
        }

        const accessories = [];

        if (line.hasAdapter) {
          accessories.push({
            assetId: asset.id,
            name: "Adapter",
            quantity: 1,
          });
        }

        if (line.hasCable) {
          accessories.push({
            assetId: asset.id,
            name: "Cáp sạc",
            quantity: 1,
          });
        }

        if (accessories.length > 0) {
          await tx.assetAccessory.createMany({
            data: accessories,
          });
        }
      }
    }
  });

  redirect(withFlash("/assets", "stock_in_created"));
}