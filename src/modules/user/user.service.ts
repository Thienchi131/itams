import { prisma } from "@/lib/prisma";

export async function getUsers(q?: string) {
  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { fullName: { contains: q, mode: "insensitive" as const } },
          { role: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  return prisma.user.findMany({
    where,
    include: {
      role: true,
      region: true,
      warehouse: true,
      warehouseAccess: { include: { warehouse: true } },
    },
    orderBy: {
      id: "asc",
    },
  });
}
export async function getUserById(id: number) {
  return prisma.user.findUnique({
    where: {
      id,
    },
    include: {
      role: true,
      region: true,
      warehouse: true,
      warehouseAccess: { include: { warehouse: true } },
    },
  });
}