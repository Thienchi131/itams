-- Tách "Chờ thanh lý" (status=RETIRED, chưa xử lý xong) và "Đã thanh lý"
-- (status=RETIRED, đã xác nhận bán/huỷ thật sự) bằng 1 cột nullable — không
-- đụng dữ liệu cũ, null nghĩa là "Chờ thanh lý" như hành vi hiện tại.
ALTER TABLE "Asset" ADD COLUMN "liquidatedAt" TIMESTAMP(3);
ALTER TABLE "Asset" ADD COLUMN "liquidatedBy" TEXT;
