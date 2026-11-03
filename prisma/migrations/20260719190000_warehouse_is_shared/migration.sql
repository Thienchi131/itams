-- Thêm cờ "kho dùng chung" — hiển thị/thao tác được cho TẤT CẢ tài khoản
-- bất kể đang bị giới hạn theo Region hay theo 1 Warehouse cụ thể.
ALTER TABLE "Warehouse" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
