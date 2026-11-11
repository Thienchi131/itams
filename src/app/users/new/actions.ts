"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password-hash";
import { redirect } from "next/navigation";
import { generateRandomPassword } from "@/lib/password";
import { sendUserPasswordEmail } from "@/lib/mail";
import { requireRole } from "@/modules/auth/auth.service";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import { withFlash } from "@/lib/flash";

export type CreateUserState =
  | { error: string }
  // Tài khoản ĐÃ tạo nhưng gửi email thất bại — trả mật khẩu tạm về cho Admin
  // tự chuyển cho user (thay vì "thành công" giả, user bị kẹt không đăng nhập
  // được mà không ai biết mật khẩu).
  | { created: { email: string; fullName: string; tempPassword: string } }
  | null;

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
  const hashedPassword = await hashPassword(plainPassword);

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

  // Await việc gửi mail (transporter đã có timeout 10s) để BIẾT kết quả.
  // Trước đây gửi kiểu "bắn rồi quên": SMTP lỗi thì chỉ ghi log, Admin vẫn
  // thấy như thành công còn user thì không bao giờ nhận được mật khẩu.
  try {
    await sendUserPasswordEmail({
      to: email,
      fullName,
      password: plainPassword,
    });
  } catch (error) {
    console.error("SEND_EMAIL_ERROR:", error);
    return { created: { email, fullName, tempPassword: plainPassword } };
  }

  redirect(withFlash("/users", "user_created"));
}
