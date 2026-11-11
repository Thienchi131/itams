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
    omit: { password: true, twoFactorSecret: true },
    include: {
      role: true,
      region: true,
      warehouse: true,
      warehouseAccess: { include: { warehouse: true } },
      yubikey: { select: { publicId: true, createdAt: true, lastUsedAt: true } },
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
    omit: { password: true, twoFactorSecret: true },
    include: {
      role: true,
      region: true,
      warehouse: true,
      warehouseAccess: { include: { warehouse: true } },
    },
  });
}