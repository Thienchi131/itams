import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Export chỉ đọc dữ liệu, không ghi/sửa gì — mở cho cả User (viewer), vẫn
  // tôn trọng đúng phạm vi Region/Kho của họ như mọi truy vấn khác bên dưới.
  const currentUser = await requireRole(["Admin", "IT", "User"]);

  const searchParams = request.nextUrl.searchParams;
  const requestedWarehouseId = searchParams.get("warehouseId");
  const teamId = searchParams.get("teamId");
  const categoryId = searchParams.get("categoryId");

  // Nếu tài khoản bị gán Region, luôn ép về đúng các kho thuộc Region đó ở
  // server — không tin param warehouseId từ client, tránh export lẫn dữ
  // liệu kho ngoài Region qua URL. Vẫn cho phép thu hẹp về đúng 1 kho cụ thể
  // trong Region nếu client có chọn (modal export), miễn là kho đó nằm
  // trong Region — chọn kho ngoài Region sẽ bị bỏ qua, coi như không chọn.
  let warehouseIds: number[] | null = null;

  if (currentUser.regionWarehouseIds) {
    const requested = requestedWarehouseId ? Number(requestedWarehouseId) : null;
    warehouseIds =
      requested && currentUser.regionWarehouseIds.includes(requested)
        ? [requested]
        : currentUser.regionWarehouseIds;
  } else if (requestedWarehouseId) {
    warehouseIds = [Number(requestedWarehouseId)];
  }

  const assets = await prisma.asset.findMany({
    where: {
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      ...(categoryId ? { model: { categoryId: Number(categoryId) } } : {}),
      ...(teamId
        ? { currentEmployee: { teamId: Number(teamId) } }
        : {}),
    },
    include: {
      model: {
        include: {
          category: true,
        },
      },
      currentEmployee: true,
      warehouse: true,
      accessories: true,
      warranties: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const headers = [
    "Asset Tag",
    "Serial Number",
    "Category",
    "Brand",
    "Model",
    "CPU",
    "RAM",
    "Storage",
    "Screen",
    "GPU",
    "Status",
    "Tình trạng",
    "Employee",
    "Warehouse",
    "Accessories",
    "Warranty Provider",
    "Warranty End Date",
    "Created At",
  ];

  const rows = assets.map((asset) => {
    const warranty = asset.warranties[0];

    return [
      asset.assetTag,
      asset.serialNumber,
      asset.model.category.name,
      asset.model.brand,
      asset.model.modelName,
      asset.actualCpu ?? asset.model.defaultCpu ?? "",
      asset.actualRam ?? asset.model.defaultRam ?? "",
      asset.actualStorage ?? asset.model.defaultStorage ?? "",
      asset.actualScreen ?? asset.model.defaultScreen ?? "",
      asset.actualGpu ?? asset.model.defaultGpu ?? "",
      asset.status,
      // "Tình trạng" (asset.condition) khác với "Status" — Status là trạng
      // thái vận hành (Trong kho/Đã cấp phát/Bảo trì...), condition là tình
      // trạng vật lý thật của thiết bị (Good/Fair/Cần sửa...). Kế toán cần
      // cột riêng này để biết thiết bị nào đang hư hỏng khi đối chiếu sổ
      // sách, không thể suy ra được từ Status.
      asset.condition ?? "",
      asset.status === "ASSIGNED" ? (asset.currentEmployee?.fullName ?? "") : "",
      asset.warehouse ? `${asset.warehouse.code} - ${asset.warehouse.name}` : "",
      asset.accessories
        .map((item) => `${item.name} x${item.quantity}`)
        .join("; "),
      warranty?.provider ?? "",
      warranty?.endDate
        ? warranty.endDate.toLocaleDateString("vi-VN")
        : "",
      asset.createdAt.toLocaleDateString("vi-VN"),
    ];
  });

  // Chặn CSV/Formula Injection: nếu 1 field (VD: tên nhân viên, ghi chú...
  // vốn có thể đến từ file Excel import) bắt đầu bằng =, +, -, @ hoặc tab/CR,
  // Excel/Sheets sẽ hiểu đó là công thức và tự thực thi khi mở file — kể cả
  // công thức đọc/gửi dữ liệu ra ngoài. Thêm dấu nháy đơn phía trước ép về
  // dạng text thuần, vô hiệu hoá công thức mà không đổi giá trị hiển thị.
  const sanitizeCsvCell = (value: unknown) => {
    const text = String(value);
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };

  const csv = [
    headers,
    ...rows,
  ]
    .map((row) =>
      row
        .map(
          (value) =>
            `"${sanitizeCsvCell(value).replace(/"/g, '""')}"`
        )
        .join(",")
    )
    .join("\n");

  const bom = "\uFEFF";

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="itams-assets-export.csv"`,
    },
  });
}