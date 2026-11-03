-- AlterEnum: thêm status "Đang luân chuyển" (IN_TRANSIT) — thiết bị đang
-- trong lượt luân chuyển kho, đã kho nguồn gửi đi nhưng chưa được IT kho
-- đích bấm "Xác nhận nhập kho". Xem model Asset (pendingTransfer* fields).
ALTER TYPE "AssetStatus" ADD VALUE 'IN_TRANSIT';
