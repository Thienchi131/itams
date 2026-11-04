import AppLayout from "../../components/AppLayout";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import NewUserForm from "./NewUserForm";

export default async function NewUserPage() {
  await requireRole(["Admin"]);

  const [roles, regions, unassignedWarehouses] = await Promise.all([
    prisma.role.findMany({
      orderBy: {
        id: "asc",
      },
    }),
    prisma.region.findMany({
      include: { warehouses: { orderBy: { code: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { regionId: null },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Thêm User
        </h2>

        <p className="mt-2 text-slate-500">
          Tạo tài khoản đăng nhập hệ thống
        </p>
      </div>

      <NewUserForm
        roles={roles}
        regions={regions}
        unassignedWarehouses={unassignedWarehouses}
      />
    </AppLayout>
  );
}