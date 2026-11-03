import { AssetStatus, AssignmentType, HistoryAction, StockInType } from "@prisma/client";

// Ngưỡng để coi 1 thiết bị đang sửa chữa/bảo hành là "quá hạn" (trang
// /assets/warranty) — cũng dùng làm chu kỳ bắt buộc IT phụ trách kho phải
// cập nhật lại "hướng xử lý" nếu thiết bị vẫn còn quá hạn (xem
// getAssetsInRepair trong asset.service.ts và RepairFollowUpBanner). Đặt ở
// đây (thay vì khai báo riêng lẻ ở từng trang) để cả trang liệt kê, banner
// nhắc nhở, và phần tính "còn hiệu lực hay đã tới hạn điền lại" luôn dùng
// chung đúng 1 con số — đổi ở đây là đổi toàn hệ thống.
export const OVERDUE_DAYS_THRESHOLD = 14;

// Tiền tố cố định của note ghi vào AssetHistory khi kho ĐÍCH từ chối 1 lượt
// luân chuyển (rejectWarehouseTransferAction trong assets/[id]/actions.ts).
// Export ra đây (thay vì hard-code chuỗi riêng ở từng nơi) để action GHI note
// và getRecentlyRejectedTransfers (asset.service.ts) ĐỌC lại — nhận diện
// đúng loại lịch sử "bị từ chối, trả về kho nguồn" bằng note.startsWith(...)
// — luôn khớp nhau dù sau này đổi câu chữ, không sợ lệch giữa 2 nơi.
export const REJECTED_TRANSFER_NOTE_PREFIX = "Kho đích từ chối nhận";

export function getHistoryActionLabel(action: HistoryAction | string) {
  switch (action) {
    case "STOCK_IN":
      return "📦 Nhập kho";
    case "STOCK_OUT":
      return "📤 Xuất kho";
    case "TRANSFER":
      return "👤 Bàn giao";
    case "WAREHOUSE_TRANSFER":
      return "🚚 Luân chuyển kho";
    case "RETURN":
      return "↩️ Thu hồi";
    case "REPAIR":
      return "🔧 Sửa chữa";
    case "RETIRE":
      return "🗑 Thanh lý";
    case "UPDATE":
      return "✏️ Cập nhật";
    default:
      return action;
  }
}

export function getAssetStatusLabel(status: AssetStatus) {
  switch (status) {
    case "IN_STOCK":
      return "Trong kho";
    case "ASSIGNED":
      return "Đang sử dụng";
    case "REPAIR":
      return "Bảo trì";
    case "RETIRED":
      return "Chờ thanh lý";
    case "LOST":
      return "Mất";
    case "IN_TRANSIT":
      return "Đang luân chuyển";
    default:
      return status;
  }
}

// Nhãn hiển thị cho từng loại cấp phát — dùng chung giữa modal bàn giao
// (client), note lưu vào AssetHistory, và trang chi tiết/danh sách cấp mượn.
export const ASSIGNMENT_TYPE_LABEL: Record<AssignmentType, string> = {
  PERMANENT: "Cấp nhân viên mới",
  LOAN: "Cấp mượn",
  WARRANTY_HOLD: "Cấp tạm chờ bảo hành",
  EXCHANGE: "Cấp đổi thiết bị",
};

// Nhãn "Loại phiếu" cho phiếu nhập kho — dùng chung giữa cột "Loại phiếu" ở
// trang Báo cáo và thống kê SL theo loại phiếu (report.service.ts).
export const STOCK_IN_TYPE_LABEL: Record<StockInType, string> = {
  NEW_PURCHASE: "Mua mới",
  RETURNED: "Thu hồi",
};

// Rút gọn "Lý do cấp phát" từ 1 dòng AssetHistory — dùng cho cột Ghi chú
// (cô đọng, bỏ chữ "Bàn giao thiết bị"/"Cấp thiết bị" thừa) và thống kê SL
// theo lý do ở báo cáo Cấp phát (report.service.ts getIssuedReport).
//
// Ưu tiên field `assignmentType` (snapshot chính xác, có từ migration
// 20260830154519_asset_history_assignment_type trở đi) — fallback parse
// phần trong ngoặc đơn ngay sau "Bàn giao thiết bị"/"Cấp thiết bị" trong
// note để vẫn đọc đúng được với TOÀN BỘ dữ liệu cũ tạo TRƯỚC migration đó
// (assignmentType null nhưng note vẫn luôn có dạng "... (Cấp nhân viên
// mới)..." — xem assignAssetAction/assignAdditionalAssetAction). Trả về
// "Khác" khi không xác định được (VD: "Chuyển thiết bị giữa nhân viên", hoặc
// dữ liệu Import lịch sử xuất kho từ Excel — không có lý do cấp phát cụ thể).
export function getAssignmentReason(
  note: string | null,
  assignmentType?: AssignmentType | null
): string {
  if (assignmentType) return ASSIGNMENT_TYPE_LABEL[assignmentType];
  if (!note) return "Khác";

  const match = note.match(/^(?:Bàn giao thiết bị|Cấp thiết bị) \(([^)]+)\)/);
  return match ? match[1] : "Khác";
}

// Số ngày cảnh báo cho từng loại — chỉ LOAN/WARRANTY_HOLD có hạn, PERMANENT
// không có (không xuất hiện trong map này = coi như vô hạn, không cảnh báo).
export const ASSIGNMENT_WARNING_DAYS: Partial<Record<AssignmentType, number>> = {
  LOAN: 60,
  WARRANTY_HOLD: 30,
};

// Tính sẵn mốc "đến hạn" lúc bàn giao (assignedAt + số ngày tương ứng) — trả
// về null cho PERMANENT (không có hạn) để lưu thẳng vào Asset.assignmentDueAt,
// tránh phải tính lại mỗi lần truy vấn "sắp/đã quá hạn".
export function computeAssignmentDueAt(
  type: AssignmentType,
  from: Date = new Date()
): Date | null {
  const days = ASSIGNMENT_WARNING_DAYS[type];
  if (!days) return null;

  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}