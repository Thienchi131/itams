import { prisma } from "@/lib/prisma";

export async function getSupplies(search?: string, warehouseIds?: number[] | null) {
  const q = search?.trim();

  return prisma.supply.findMany({
    where: {
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { warehouse: true },
    orderBy: { id: "desc" },
  });
}

export async function getSupplyById(id: number) {
  return prisma.supply.findUnique({
    where: { id },
    include: {
      warehouse: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export function isLowStock(supply: { quantity: number; minQuantity: number }) {
  return supply.minQuantity > 0 && supply.quantity <= supply.minQuantity;
}

export async function countLowStockSupplies(warehouseIds?: number[] | null) {
  const supplies = await prisma.supply.findMany({
    where: {
      minQuantity: { gt: 0 },
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    },
  });

  return supplies.filter((s) => s.quantity <= s.minQuantity).length;
}
