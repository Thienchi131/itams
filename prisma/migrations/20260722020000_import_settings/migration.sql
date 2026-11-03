-- Cho phép Admin bật/tắt tính năng Import Excel (Cài đặt > Import Excel) mà
-- không cần deploy code. Mặc định BẬT để giữ nguyên hành vi hiện tại.

-- CreateTable
CREATE TABLE "ImportSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ImportSettings_pkey" PRIMARY KEY ("id")
);

-- Seed sẵn đúng 1 dòng config, mặc định BẬT.
INSERT INTO "ImportSettings" ("id", "enabled", "updatedAt")
VALUES (1, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
