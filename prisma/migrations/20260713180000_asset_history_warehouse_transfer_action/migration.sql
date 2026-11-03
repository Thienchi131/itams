-- Thêm giá trị mới cho enum HistoryAction để phân biệt "luân chuyển kho"
-- (đổi warehouseId của thiết bị) với TRANSFER (vốn chỉ dùng cho bàn giao
-- thiết bị giữa các nhân viên).
ALTER TYPE "HistoryAction" ADD VALUE 'WAREHOUSE_TRANSFER';
