-- DropIndex
-- IF EXISTS: migration này lúc đầu tạo ra trên máy dev (khi index đã có sẵn
-- do lệch state), nhưng trên database mới hoàn toàn thì migration tạo ra
-- "User_warehouseId_idx" (20260707100000_user_warehouse_scope) lại nằm SAU
-- migration này theo thứ tự thời gian -> DROP thẳng sẽ lỗi vì index chưa
-- tồn tại. Thêm IF EXISTS để an toàn với mọi thứ tự.
DROP INDEX IF EXISTS "User_warehouseId_idx";
