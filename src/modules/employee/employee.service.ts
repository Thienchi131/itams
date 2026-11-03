import { prisma } from "@/lib/prisma";

// Nhân viên là danh bạ chung của cả công ty, KHÔNG scope theo kho/khu vực —
// khác với Asset/Supply vốn thực sự nằm ở 1 kho cụ thể. Trước đây có lọc
// theo warehouseIds (chỉ hiện nhân viên đang giữ thiết bị thuộc kho được
// phân quyền) nhưng điều đó khiến tài khoản scope hẹp (VD role IT bị gán 1
// kho cụ thể) không thấy được nhân viên nào cả nếu chưa có ai đang giữ thiết
// bị đúng kho đó — sai vì mọi người cần xem/tìm được toàn bộ nhân viên để
// cấp phát thiết bị, không chỉ nhân viên "thuộc" kho của mình.
export async function getEmployees(q?: string) {
  const where = q
    ? {
        OR: [
          { employeeCode: { contains: q, mode: "insensitive" as const } },
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { team: { name: { contains: q, mode: "insensitive" as const } } },
          { position: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  return prisma.employee.findMany({
    where,
    include: {
      team: true,
      position: true,
      // include model: cần cho picker "Cấp đổi thiết bị" ở AssignAssetForm
      // (assets/[id]) — chọn 1 trong các thiết bị nhân viên đang giữ để thu
      // hồi đổi lấy máy mới, phải hiện được tên model chứ không chỉ Asset Tag.
      assets: { include: { model: true } },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Bản phân trang của getEmployees() ở trên — dùng riêng cho trang danh sách
// /employees (bảng dài, có thể có hàng trăm nhân viên). Tách hàm riêng thay
// vì thêm tham số page vào getEmployees() vì hàm đó còn được nhiều nơi khác
// gọi để lấy TOÀN BỘ danh sách làm bảng tra cứu theo id (VD trang chi tiết
// thiết bị hiển thị tên người đang giữ) — những chỗ đó không được phép chỉ
// nhận về 1 trang.
export async function getEmployeesPaginated(q?: string, page: number = 1) {
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const where = q
    ? {
        OR: [
          { employeeCode: { contains: q, mode: "insensitive" as const } },
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { team: { name: { contains: q, mode: "insensitive" as const } } },
          { position: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [employees, total, totalActive] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        team: true,
        position: true,
        assets: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
    prisma.employee.count({ where: { ...where, isActive: true } }),
  ]);

  return {
    employees,
    total,
    totalActive,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
  };
}

/**
 * Nhóm các nhân viên bị trùng tên (thường do lỗi nhập liệu lúc import Excel
 * tạo 2 employeeCode khác nhau cho cùng 1 người) — so khớp theo fullName đã
 * chuẩn hoá (bỏ khoảng trắng thừa, không phân biệt hoa/thường). Dùng để
 * cảnh báo và gộp thiết bị về 1 bản ghi duy nhất.
 */
export async function getDuplicateEmployeeGroups() {
  const employees = await prisma.employee.findMany({
    include: {
      team: true,
      position: true,
      assets: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof employees>();

  for (const employee of employees) {
    const key = employee.fullName.trim().toLowerCase().replace(/\s+/g, " ");

    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(employee);
  }

  return [...groups.values()].filter((group) => group.length > 1);
}

export async function getEmployeeById(id: number) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      team: true,
      position: true,
      assets: {
        include: {
          model: true,
          warehouse: true,
          accessories: true,
        },
      },
    },
  });
}