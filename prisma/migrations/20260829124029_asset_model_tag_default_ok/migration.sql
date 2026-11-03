-- Backfill: toàn bộ model hiện có chưa gắn tag (đang NULL) mặc định là OK
-- (cấp phát được) — theo yêu cầu "mặc định toàn bộ model là ok hết".
UPDATE "AssetModel" SET "tag" = 'OK' WHERE "tag" IS NULL;

-- AlterTable: từ nay mọi model MỚI tạo (không truyền tag) cũng tự động là
-- OK thay vì NULL, khỏi phải vào Cài đặt > Tag Model gắn tay từng model mới.
ALTER TABLE "AssetModel" ALTER COLUMN "tag" SET DEFAULT 'OK';
