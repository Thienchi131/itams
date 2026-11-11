import AppLayout from "../../components/AppLayout";
import { getAssetModels } from "@/modules/models/model.service";
import { getEmployees } from "@/modules/employee/employee.service";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT } from "@/modules/auth/permissions";
import StockInForm from "./StockInForm";

export default async function StockInPage() {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT]);

  const [models, allWarehouses, employees] = await Promise.all([
    getAssetModels(),
    prisma.warehouse.findMany({ orderBy: { code: "asc" } }),
    // Dùng cho mục "Thu hồi từ ai" khi Loại nhập kho = Thu hồi — danh bạ nhân
    // viên KHÔNG scope theo kho/Region (xem ghi chú ở employee.service.ts),
    // nên không cần lọc theo currentUser ở đây.
    getEmployees(),
  ]);

  // IT bị gán Region chỉ được nhập hàng vào các kho thuộc Region đó (khoá
  // lại ở cả UI lẫn server action, không cho chọn kho ngoài Region).
  const warehouses = currentUser.regionWarehouseIds
    ? allWarehouses.filter((w) => currentUser.regionWarehouseIds!.includes(w.id))
    : allWarehouses;

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Phiếu nhập thiết bị</h2>
        <p className="text-slate-500">
          Chọn Model có sẵn và nhập nhiều Serial Number
        </p>
      </div>

      <StockInForm
        models={models}
        warehouses={warehouses}
        employees={employees}
        isAdmin={currentUser.role.name === ROLE_ADMIN}
      />
    </AppLayout>
  );
}