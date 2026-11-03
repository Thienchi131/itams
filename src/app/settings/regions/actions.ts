"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";

// Tạo/sửa/xoá Khu vực là thay đổi cấu trúc phân quyền theo kho (ảnh hưởng
// admin/user nào thấy được kho nào) — chỉ Admin được làm, giống Quản lý kho.
const REQUIRE_ROLES = ["Admin"];

export async function createRegionAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const name = String(formData.get("name") || "").trim();

  if (!name) {
    redirect("/settings/regions?error=missing_fields");
  }

  const existed = await prisma.region.findUnique({ where: { name } });

  if (existed) {
    redirect("/settings/regions?error=duplicate_name");
  }

  await prisma.region.create({ data: { name } });

  redirect("/settings/regions?success=created");
}

export async function updateRegionAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    redirect("/settings/regions?error=missing_fields");
  }

  const existed = await prisma.region.findFirst({ where: { name, id: { not: id } } });

  if (existed) {
    redirect("/settings/regions?error=duplicate_name");
  }

  await prisma.region.update({ where: { id }, data: { name } });

  redirect("/settings/regions?success=updated");
}

export async function deleteRegionAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const id = Number(formData.get("id"));

  // Chặn xoá nếu vẫn còn kho hoặc user đang gán vào Region này — xoá thẳng
  // sẽ làm mất phân quyền của user (regionId trỏ tới Region không còn tồn
  // tại) hoặc kho bị bỏ ngỏ ngoài mọi Region. Bắt Admin gỡ hết trước: đổi
  // kho sang Region khác (hoặc để trống) và đổi Region cho user liên quan.
  const [warehouseCount, userCount] = await Promise.all([
    prisma.warehouse.count({ where: { regionId: id } }),
    prisma.user.count({ where: { regionId: id } }),
  ]);

  if (warehouseCount > 0 || userCount > 0) {
    redirect(
      `/settings/regions?error=in_use&warehouses=${warehouseCount}&users=${userCount}`
    );
  }

  await prisma.region.delete({ where: { id } });

  redirect("/settings/regions?success=deleted");
}
