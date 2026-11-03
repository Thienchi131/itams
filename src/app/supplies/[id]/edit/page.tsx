import AppLayout from "../../../components/AppLayout";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import EditSupplyForm from "./EditSupplyForm";

export default async function EditSupplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const { id } = await params;
  const supply = await prisma.supply.findUnique({
    where: { id: Number(id) },
    include: { warehouse: true },
  });

  if (!supply) notFound();

  // IT bị gán Region chỉ sửa được vật tư thuộc 1 trong các kho của Region đó
  // — vật tư ngoài Region coi như không tồn tại với họ (giống cách asset
  // đang bị chặn).
  if (
    currentUser.regionWarehouseIds &&
    (supply.warehouseId === null ||
      !currentUser.regionWarehouseIds.includes(supply.warehouseId))
  ) {
    notFound();
  }

  const allWarehouses = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });

  // Admin chọn được bất kỳ kho nào; IT bị gán Region chỉ chọn được trong số
  // các kho thuộc Region đó (không còn khoá cứng về đúng 1 kho như trước).
  const warehouses = currentUser.regionWarehouseIds
    ? allWarehouses.filter((w) => currentUser.regionWarehouseIds!.includes(w.id))
    : allWarehouses;

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Sửa vật tư</h2>
        <p className="text-slate-500">
          Số lượng tồn kho không sửa trực tiếp ở đây — dùng nút Nhập/Xuất ở
          trang chi tiết để giữ đúng lịch sử giao dịch.
        </p>
      </div>

      <EditSupplyForm
        supply={supply}
        regionWarehouseIds={currentUser.regionWarehouseIds}
        warehouses={warehouses}
      />
    </AppLayout>
  );
}
