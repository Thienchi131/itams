import { prisma } from "@/lib/prisma";
import { HistoryAction, StockInType } from "@prisma/client";
import {
  ASSIGNMENT_TYPE_LABEL,
  STOCK_IN_TYPE_LABEL,
  getAssignmentReason,
} from "@/modules/asset/asset.helpers";

export type ReportMode = "month" | "year";

export type ReportPeriod = {
  mode: ReportMode;
  year: number;
  month: number | null;
  start: Date;
  end: Date;
  label: string;
};

// Tính khoảng thời gian [start, end) theo Tháng hoặc Năm — dùng nửa khoảng hở
// ở "end" (dùng lt thay vì lte khi query) để không bị lệch múi giờ/giây cuối
// ngày 31, tránh phải tính "ngày cuối tháng" thủ công.
export function resolvePeriod(
  mode: ReportMode,
  year: number,
  month: number | null
): ReportPeriod {
  if (mode === "month" && month) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { mode, year, month, start, end, label: `Tháng ${month}/${year}` };
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return { mode: "year", year, month: null, start, end, label: `Năm ${year}` };
}

/**
 * Báo cáo NHẬP KHO trong kỳ — nguồn dữ liệu là StockInItem/StockInSlip, vì
 * đây là nơi DUY NHẤT ghi nhận đầy đủ mọi lượt nhập kho thật (cả từ form nhập
 * kho thủ công lẫn Import Excel đều tạo StockInSlip+StockInItem — xem
 * stock-in/actions.ts và import/actions.ts). KHÔNG dùng AssetHistory
 * action=STOCK_IN làm nguồn chính vì chỉ Import Excel ghi action này, form
 * nhập kho thủ công (đường nhập chính, phổ biến hơn nhiều) không tạo dòng đó.
 *
 * Lọc theo kho dùng Asset.warehouseId (kho THẬT của từng thiết bị) thay vì
 * StockInSlip.warehouseId — phiếu từ Import Excel cố tình để trống
 * warehouseId vì 1 file có thể gồm nhiều kho khác nhau (xem comment gốc ở
 * import/actions.ts).
 */
export async function getStockInReport(
  period: ReportPeriod,
  warehouseIds?: number[] | null
) {
  const items = await prisma.stockInItem.findMany({
    where: {
      stockInSlip: { stockInDate: { gte: period.start, lt: period.end } },
      ...(warehouseIds ? { asset: { warehouseId: { in: warehouseIds } } } : {}),
    },
    include: {
      asset: {
        include: {
          model: { include: { category: true } },
          warehouse: true,
        },
      },
      stockInSlip: true,
    },
    orderBy: { stockInSlip: { stockInDate: "desc" } },
  });

  type ModelSummary = {
    modelId: number;
    brand: string;
    modelName: string;
    categoryName: string | null;
    quantity: number;
  };

  const byModel = new Map<number, ModelSummary>();
  for (const item of items) {
    const m = item.asset.model;
    const existing = byModel.get(m.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      byModel.set(m.id, {
        modelId: m.id,
        brand: m.brand,
        modelName: m.modelName,
        categoryName: m.category?.name ?? null,
        quantity: 1,
      });
    }
  }

  // Thu hồi từ ai — lấy từ AssetHistory action=RETURN được ghi ngay lúc nhập
  // kho dạng Thu hồi (xem stock-in/actions.ts). Mỗi Asset ở báo cáo này được
  // TẠO MỚI ngay lúc nhập (form Thu hồi không tái dùng asset cũ), nên mỗi
  // asset chỉ có tối đa 1 dòng RETURN — không lo lẫn với thiết bị được thu
  // hồi/bàn giao lại nhiều lần sau đó qua trang chi tiết tài sản.
  const assetIds = items.map((item) => item.assetId);
  const returnHistories = assetIds.length
    ? await prisma.assetHistory.findMany({
        where: { assetId: { in: assetIds }, action: HistoryAction.RETURN },
      })
    : [];
  const fromEmployeeIdByAssetId = new Map<number, number>();
  for (const h of returnHistories) {
    if (h.fromEmployeeId !== null) {
      fromEmployeeIdByAssetId.set(h.assetId, h.fromEmployeeId);
    }
  }

  const recalledEmployeeIds = Array.from(new Set(fromEmployeeIdByAssetId.values()));
  const recalledEmployees = recalledEmployeeIds.length
    ? await prisma.employee.findMany({ where: { id: { in: recalledEmployeeIds } } })
    : [];
  const recalledEmployeeById = new Map(recalledEmployees.map((e) => [e.id, e]));

  // Thống kê SL theo Loại phiếu (Mua mới / Thu hồi) — hiện thành 1 dòng
  // tóm tắt phía trên bảng "Danh sách thiết bị đã nhập" ở trang Báo cáo.
  // Duyệt cố định theo thứ tự khai báo của StockInType (không theo Map, tránh
  // thứ tự đảo lộn tuỳ ý xuất hiện trước) và bỏ qua loại không có dòng nào
  // trong kỳ (khỏi hiện "Thu hồi: 0" gây rối mắt khi kỳ đó chỉ có Mua mới).
  const stockInTypeCounts = new Map<StockInType, number>();
  for (const item of items) {
    const type = item.stockInSlip.stockInType;
    stockInTypeCounts.set(type, (stockInTypeCounts.get(type) ?? 0) + 1);
  }
  const byStockInType = (Object.keys(STOCK_IN_TYPE_LABEL) as StockInType[])
    .filter((type) => stockInTypeCounts.has(type))
    .map((type) => ({
      type,
      label: STOCK_IN_TYPE_LABEL[type],
      quantity: stockInTypeCounts.get(type)!,
    }));

  return {
    totalCount: items.length,
    byModel: Array.from(byModel.values()).sort((a, b) => b.quantity - a.quantity),
    byStockInType,
    items: items.map((item) => {
      const empId = fromEmployeeIdByAssetId.get(item.assetId);
      return {
        ...item,
        recalledFromEmployee: empId ? recalledEmployeeById.get(empId) ?? null : null,
      };
    }),
  };
}

/**
 * Báo cáo XUẤT KHO / CẤP PHÁT trong kỳ — nguồn dữ liệu là AssetHistory
 * action=TRANSFER có toEmployeeId (mọi lượt bàn giao thiết bị cho nhân viên
 * đều ghi dòng này — xem assets/[id]/actions.ts assignAssetAction,
 * employees/[id]/actions.ts assignAdditionalAssetAction, và khối "xuất kho"
 * của Import Excel). Cố tình KHÔNG gồm StockOutSlip/StockOutItem — 2 model
 * này tồn tại trong schema nhưng không nơi nào trong code thực sự tạo dữ
 * liệu (dead model), không phải nguồn đáng tin cậy.
 *
 * fromEmployeeId=null nghĩa là cấp MỚI từ kho; fromEmployeeId khác null nghĩa
 * là bàn giao lại giữa 2 nhân viên — báo cáo gộp cả 2 loại vì cả 2 đều là
 * "thiết bị đã cấp cho ai" theo đúng nghĩa người dùng hỏi.
 */
export async function getIssuedReport(
  period: ReportPeriod,
  warehouseIds?: number[] | null
) {
  const histories = await prisma.assetHistory.findMany({
    where: {
      action: HistoryAction.TRANSFER,
      toEmployeeId: { not: null },
      createdAt: { gte: period.start, lt: period.end },
      ...(warehouseIds ? { asset: { warehouseId: { in: warehouseIds } } } : {}),
    },
    include: {
      asset: { include: { model: true, warehouse: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const employeeIds = Array.from(
    new Set(
      histories
        .map((h) => h.toEmployeeId)
        .filter((id): id is number => id !== null)
    )
  );

  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        include: { team: true },
      })
    : [];
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  type EmployeeSummary = {
    employeeId: number;
    fullName: string;
    teamName: string | null;
    quantity: number;
  };

  const byEmployee = new Map<number, EmployeeSummary>();
  for (const h of histories) {
    if (h.toEmployeeId === null) continue;
    const emp = employeeById.get(h.toEmployeeId);
    const existing = byEmployee.get(h.toEmployeeId);
    if (existing) {
      existing.quantity += 1;
    } else {
      byEmployee.set(h.toEmployeeId, {
        employeeId: h.toEmployeeId,
        fullName: emp?.fullName ?? `#${h.toEmployeeId}`,
        teamName: emp?.team?.name ?? null,
        quantity: 1,
      });
    }
  }

  // Thống kê SL theo Lý do cấp phát — hiện thành 1 dòng tóm tắt phía trên
  // bảng "Danh sách thiết bị đã cấp phát" ở trang Báo cáo. Dùng
  // getAssignmentReason() thay vì đọc thẳng field assignmentType — field đó
  // chỉ có từ migration 20260830154519 trở đi, đọc thẳng sẽ khiến TOÀN BỘ dữ
  // liệu cũ rơi vào 1 bucket "Khác" vô nghĩa (đã gặp thực tế: 37/37 dòng cũ
  // đều "Khác"). getAssignmentReason() tự fallback parse note nên vẫn nhóm
  // đúng cho cả dữ liệu cũ. Duyệt theo thứ tự cố định (các Loại cấp phát đã
  // biết trước, "Khác" luôn ở cuối) thay vì theo thứ tự xuất hiện ngẫu nhiên.
  const reasonCounts = new Map<string, number>();
  for (const h of histories) {
    const reason = getAssignmentReason(h.note, h.assignmentType);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const reasonOrder = [...Object.values(ASSIGNMENT_TYPE_LABEL), "Khác"];
  const byReason = reasonOrder
    .filter((label) => reasonCounts.has(label))
    .map((label) => ({ label, quantity: reasonCounts.get(label)! }));

  return {
    totalCount: histories.length,
    byEmployee: Array.from(byEmployee.values()).sort(
      (a, b) => b.quantity - a.quantity
    ),
    byReason,
    items: histories.map((h) => ({
      ...h,
      employee: h.toEmployeeId ? employeeById.get(h.toEmployeeId) ?? null : null,
      reason: getAssignmentReason(h.note, h.assignmentType),
    })),
  };
}
