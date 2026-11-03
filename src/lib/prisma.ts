import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Trước đây log query luôn bật kể cả ở production — mọi câu SQL (kèm giá
// trị, có thể là dữ liệu nhạy cảm) bị đổ ra log container liên tục, vừa dư
// thừa vừa là 1 kênh rò rỉ dữ liệu không cần thiết nếu log server từng bị
// truy cập trái phép. Chỉ log query đầy đủ khi dev, production chỉ giữ lại
// error/warn để vẫn debug được sự cố mà không xả log nhạy cảm.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;