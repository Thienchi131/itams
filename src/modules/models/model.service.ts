import { prisma } from "@/lib/prisma";

export async function getAssetModels(search?: string) {
  const q = search?.trim();

  return prisma.assetModel.findMany({
    where: q
      ? {
          OR: [
            { modelCode: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { modelName: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      category: true,
      // Trang Model Library chỉ cần SỐ LƯỢNG thiết bị mỗi model để hiển thị
      // (badge "N thiết bị" + gợi ý model nào nên giữ lại khi gộp) — trước
      // đây dùng "assets: true" kéo về NGUYÊN VẸN từng dòng Asset đầy đủ mọi
      // cột (assetTag, serialNumber, actualCpu/Ram/Storage, note, lịch sử
      // ngày tháng...) của TẤT CẢ thiết bị thuộc TẤT CẢ model, không phân
      // trang — với hệ thống có hàng nghìn thiết bị, đây là nguyên nhân
      // chính khiến trang Model Library tải chậm nhất trong toàn app. Dùng
      // _count để DB tự đếm bằng SQL COUNT(), không kéo dữ liệu thô về.
      _count: {
        select: { assets: true },
      },
    },
    orderBy: {
      id: "desc",
    },
  });
}