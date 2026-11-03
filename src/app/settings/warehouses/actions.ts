"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";

// Tạo/sửa/xoá kho là thay đổi cấu trúc tổ chức (ảnh hưởng phân quyền theo
// kho của cả IT lẫn User) — chỉ Admin được làm, giống Quản lý tài khoản.
const REQUIRE_ROLES = ["Admin"];

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

// Dùng redirect kèm ?error=... thay vì throw Error trực tiếp — throw trong
// 1 server action gắn với <form action={...}> thường sẽ làm Next.js hiện
// nguyên trang lỗi (error boundary) thay vì thông báo gọn trong trang, trải
// nghiệm xấu cho lỗi validate bình thường (trùng mã kho, còn asset chưa
// chuyển đi...). Đã từng vá lỗi tương tự ở trang bàn giao thiết bị.
export async function createWarehouseAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const code = normalizeCode(String(formData.get("code") || ""));
  const name = String(formData.get("name") || "").trim();
  const regionId = Number(formData.get("regionId")) || null;
  const isShared = formData.get("isShared") === "on";

  if (!code || !name) {
    redirect("/settings/warehouses?error=missing_fields");
  }

  const existed = await prisma.warehouse.findUnique({ where: { code } });

  if (existed) {
    redirect(`/settings/warehouses?error=duplicate_code&code=${encodeURIComponent(code)}`);
  }

  await prisma.warehouse.create({ data: { code, name, regionId, isShared } });

  redirect("/settings/warehouses?success=created");
}

export async function updateWarehouseAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const id = Number(formData.get("id"));
  const code = normalizeCode(String(formData.get("code") || ""));
  const name = String(formData.get("name") || "").trim();
  const regionId = Number(formData.get("regionId")) || null;
  const isShared = formData.get("isShared") === "on";

  if (!code || !name) {
    redirect("/settings/warehouses?error=missing_fields");
  }

  const existed = await prisma.warehouse.findUnique({ where: { code } });

  if (existed && existed.id !== id) {
    redirect(`/settings/warehouses?error=duplicate_code&code=${encodeURIComponent(code)}`);
  }

  await prisma.warehouse.update({
    where: { id },
    data: { code, name, regionId, isShared },
  });

  redirect("/settings/warehouses?success=updated");
}

export async function deleteWarehouseAction(formData: FormData) {
  await requireRole(REQUIRE_ROLES);

  const id = Number(formData.get("id"));

  // Chặn xoá nếu vẫn còn asset hoặc vật tư đang gán vào kho này — xoá thẳng
  // sẽ để lại asset/supply mồ côi (warehouseId trỏ tới 1 kho không còn tồn
  // tại). Bắt Admin luân chuyển hết trước.
  // User.warehouseId (gán phạm vi xem theo ĐÚNG 1 kho lẻ) cũng phải chặn —
  // FK khai báo ON DELETE SET NULL, nếu không chặn ở đây thì xoá kho sẽ âm
  // thầm null hoá warehouseId của user đó, biến họ thành tài khoản "không
  // giới hạn" (thấy hết mọi kho) ngoài ý muốn thay vì báo lỗi rõ ràng.
  const [assetCount, supplyCount, userCount] = await Promise.all([
    prisma.asset.count({ where: { warehouseId: id } }),
    prisma.supply.count({ where: { warehouseId: id } }),
    prisma.user.count({ where: { warehouseId: id } }),
  ]);

  if (assetCount > 0 || supplyCount > 0 || userCount > 0) {
    redirect(
      `/settings/warehouses?error=in_use&assets=${assetCount}&supplies=${supplyCount}&users=${userCount}`
    );
  }

  await prisma.warehouse.delete({ where: { id } });

  redirect("/settings/warehouses?success=deleted");
}
