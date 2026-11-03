import AppLayout from "../../components/AppLayout";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import NewSupplyForm from "./NewSupplyForm";

export default async function NewSupplyPage() {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  // Admin chọn được bất kỳ kho nào; IT bị gán Region chỉ chọn được trong số
  // các kho thuộc Region đó (bị ép lại lần nữa ở server action).
  const allWarehouses = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
  const warehouses = currentUser.regionWarehouseIds
    ? allWarehouses.filter((w) => currentUser.regionWarehouseIds!.includes(w.id))
    : allWarehouses;

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Thêm vật tư</h2>
        <p className="text-slate-500">
          Tạo mục vật tư mới trong kho vật tư (quản lý theo số lượng)
        </p>
      </div>

      <NewSupplyForm
        regionWarehouseIds={currentUser.regionWarehouseIds}
        warehouses={warehouses}
      />
    </AppLayout>
  );
}
