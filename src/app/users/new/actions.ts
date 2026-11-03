"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { generateRandomPassword } from "@/lib/password";
import { sendUserPasswordEmail } from "@/lib/mail";
import { requireRole } from "@/modules/auth/auth.service";
import { createAuditLog } from "@/modules/audit/audit-log.service";

export type CreateUserState = { error: string } | null;

export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  // Trước đây action này KHÔNG có guard nào — bất kỳ user đăng nhập nào
  // (kể cả IT/Viewer) cũng có thể tự tạo tài khoản mới (kể cả Admin) bằng
  // cách gọi thẳng server action, bỏ qua hoàn toàn UI ẩn nút. Chỉ Admin mới
  // được tạo tài khoản.
  const currentUser = await requireRole(["Admin"]);

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleId = Number(formData.get("roleId"));
  const regionIdRaw = String(formData.get("regionId") || "").trim();
  const warehouseIdRaw = String(formData.get("warehouseId") || "").trim();
  // UserScopeSelect chỉ gửi lên 1 trong 2 giá trị tại 1 thời điểm (dropdown
  // dùng chung, tách ra 2 input ẩn) — warehouseId ưu tiên nếu vì lý do gì đó
  // cả 2 cùng có giá trị (phạm vi hẹp hơn, an toàn hơn).
  const warehouseId = warehouseIdRaw ? Number(warehouseIdRaw) : null;
  const regionId = !warehouseId && regionIdRaw ? Number(regionIdRaw) : null;

  // Kho bổ sung (ExtraWarehouseAccessPicker) — nhiều checkbox cùng tên, độc
  // lập với regionId/warehouseId ở trên. Xem ghi chú trong
  // UserWarehouseAccess (schema.prisma) và getCurrentUser() (auth.service.ts).
  const extraWarehouseIds = formData
    .getAll("extraWarehouseIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!fullName || !email || !roleId) {
    return { error: "Thiếu thông tin tạo tài khoản" };
  }

  // Trước đây throw new Error() ở đây — nhưng Next.js che (redact) hết nội
  // dung message của lỗi throw trong Server Action khi chạy production
  // build, chỉ giữ lại message đầy đủ lúc chạy "next dev" (đây là lý do bug
  // này lọt qua suốt quá trình code, chỉ lộ ra khi chạy thật trên VPS) —
  // người dùng chỉ thấy trang lỗi chung chung "An error occurred in the
  // Server Components render...". Đổi qua RETURN lỗi như dữ liệu bình
  // thường (kết hợp useActionState ở form) thì message luôn hiển thị đúng,
  // không bị Next.js che.
  const [existedEmail, existedName] = await Promise.all([
    prisma.user.findFirst({ where: { username: email } }),
    prisma.user.findFirst({
      where: { fullName: { equals: fullName, mode: "insensitive" } },
    }),
  ]);

  if (existedEmail) {
    return { error: `Email "${email}" đã có tài khoản, vui lòng dùng email khác.` };
  }

  if (existedName) {
    return {
      error: `Đã có tài khoản tên "${existedName.fullName}" (email ${existedName.username}) — kiểm tra lại tránh tạo trùng người. Nếu chắc chắn là 2 người khác nhau trùng tên, đổi Họ và tên nhập thêm ký tự phân biệt rồi tạo lại.`,
    };
  }

  const plainPassword = generateRandomPassword(12);
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const newUser = await prisma.user.create({
    data: {
      username: email,
      fullName,
      password: hashedPassword,
      roleId,
      regionId,
      warehouseId,
      warehouseAccess:
        extraWarehouseIds.length > 0
          ? { create: extraWarehouseIds.map((id) => ({ warehouseId: id })) }
          : undefined,
    },
  });

  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Tạo tài khoản",
    targetType: "User",
    targetId: newUser.id,
    detail: `${fullName} (${email})`,
  });

  // Không await — nếu SMTP bị chặn/chậm (rất hay gặp với VPS chặn port
  // mail đi ra), await ở đây sẽ treo cả trang tới khi timeout. Gửi nền,
  // lỗi chỉ log lại; tài khoản đã tạo thành công trong DB rồi nên không
  // ảnh hưởng tới nghiệp vụ.
  sendUserPasswordEmail({
    to: email,
    fullName,
    password: plainPassword,
  }).catch((error) => {
    console.error("SEND_EMAIL_ERROR:", error);
  });

  redirect("/users");
}