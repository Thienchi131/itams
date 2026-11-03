import { prisma } from "@/lib/prisma";

// Kèm số kho + số user đang gán vào từng Region — dùng để quyết định có
// cho xoá Region hay không (không cho xoá nếu vẫn còn kho/user tham chiếu
// tới, tránh mồ côi dữ liệu/mất phân quyền) và để Admin thấy trước hệ quả
// trước khi xoá.
export async function getRegionsWithCounts() {
  return prisma.region.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { warehouses: true, users: true },
      },
    },
  });
}
