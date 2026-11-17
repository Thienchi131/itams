import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { buildImportTemplate } from "@/modules/asset/import-template";

const STATUS_VI: Record<string, string> = {
  IN_STOCK: "Trong kho",
  ASSIGNED: "Đã giao",
  REPAIR: "Bảo trì",
  RETIRED: "Thanh lý",
  LOST: "Mất",
  IN_TRANSIT: "Đang luân chuyển",
};

// GET /assets/import/template — tải file Excel mẫu để điền rồi Import, sinh
// từ dữ liệu hiện tại (model, kho, team, nhân viên, serial đã có) nên danh
// sách chọn luôn mới. IT chỉ thấy các kho thuộc phạm vi của mình.
export async function GET() {
  const currentUser = await requireRole(["Admin", "IT"]);
  const scope = currentUser.regionWarehouseIds;

  const [models, counts, warehouses, teams, staff, employees, assets] = await Promise.all([
    prisma.assetModel.findMany({
      select: { id: true, modelCode: true, brand: true, modelName: true, tag: true, category: { select: { name: true } } },
    }),
    prisma.asset.groupBy({ by: ["modelId"], _count: { _all: true } }),
    prisma.warehouse.findMany({
      where: scope ? { id: { in: scope } } : undefined,
      select: { code: true, name: true, region: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.team.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { name: { in: ["Admin", "IT"] } } },
      select: { fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: { fullName: true, employeeCode: true, team: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.asset.findMany({
      select: { serialNumber: true, status: true },
      orderBy: { serialNumber: "asc" },
    }),
  ]);

  const countByModel = new Map(counts.map((c) => [c.modelId, c._count._all]));
  const byText = (a: string, b: string) => a.localeCompare(b, "vi", { sensitivity: "base" });

  const buffer = await buildImportTemplate({
    models: models
      .filter((m) => m.modelCode)
      .map((m) => ({
        code: m.modelCode as string,
        category: m.category?.name ?? "",
        brand: m.brand ?? "",
        name: m.modelName ?? "",
        tag: m.tag ?? "",
        assetCount: countByModel.get(m.id) ?? 0,
      }))
      .sort((a, b) => byText(a.category, b.category) || byText(a.brand, b.brand) || byText(a.name, b.name)),
    warehouses: warehouses.map((w) => ({ code: w.code, name: w.name, region: w.region?.name ?? "" })),
    teams: teams.map((t) => t.name).filter(Boolean),
    itStaff: [...new Set(staff.map((s) => s.fullName).filter(Boolean))],
    employees: employees.map((e) => ({ fullName: e.fullName, team: e.team?.name ?? "", code: e.employeeCode })),
    serials: assets.map((a) => ({ serial: a.serialNumber as string, status: STATUS_VI[a.status] ?? a.status })),
    generatedAt: new Date(),
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ITAMS_Mau_Import_${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
