-- AlterTable: snapshot Loại cấp phát tại thời điểm bàn giao (TRANSFER) —
-- dùng cho thống kê "SL theo loại phiếu" ở trang Báo cáo. NULL cho các dòng
-- lịch sử cũ trước migration này (không backfill được vì không còn biết
-- chính xác loại cấp phát của từng lượt bàn giao đã qua).
ALTER TABLE "AssetHistory" ADD COLUMN "assignmentType" "AssignmentType";
