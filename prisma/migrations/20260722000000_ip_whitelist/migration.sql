-- Tính năng "Whitelist IP" (Cài đặt > Whitelist IP): chặn TOÀN BỘ hệ thống
-- (kể cả trang đăng nhập) với IP không nằm trong danh sách, khi được bật.
-- Việc chặn thật sự nằm ở custom server (server.js) chứ không phải ở đây —
-- 2 bảng này chỉ lưu cấu hình.

-- CreateTable
CREATE TABLE "IpWhitelistEntry" (
    "id" SERIAL NOT NULL,
    "cidr" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpWhitelistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IpWhitelistEntry_cidr_key" ON "IpWhitelistEntry"("cidr");

-- CreateTable
CREATE TABLE "IpWhitelistConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "IpWhitelistConfig_pkey" PRIMARY KEY ("id")
);

-- Seed sẵn đúng 1 dòng config, mặc định TẮT — Admin phải chủ động vào Cài
-- đặt để bật sau khi đã thêm IP của chính mình vào danh sách.
INSERT INTO "IpWhitelistConfig" ("id", "enabled", "updatedAt")
VALUES (1, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Seed sẵn IP của Henry (người yêu cầu tính năng này) để không phải vào UI
-- thêm tay — whitelist vẫn đang TẮT ở dòng trên nên chưa có tác dụng gì cho
-- tới khi chủ động bật ở Cài đặt > Whitelist IP.
INSERT INTO "IpWhitelistEntry" ("cidr", "description", "createdBy")
VALUES ('108.165.86.253', 'Henry', 'System (seed lúc migration)')
ON CONFLICT ("cidr") DO NOTHING;
