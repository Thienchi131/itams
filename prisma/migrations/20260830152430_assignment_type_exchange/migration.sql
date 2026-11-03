-- AlterEnum: thêm loại cấp phát mới "Cấp đổi thiết bị" (EXCHANGE) — bàn giao
-- thiết bị mới đồng thời thu hồi lại đúng 1 thiết bị cũ nhân viên đang giữ.
ALTER TYPE "AssignmentType" ADD VALUE 'EXCHANGE';
