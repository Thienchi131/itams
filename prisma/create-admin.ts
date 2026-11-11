/**
 * Tạo mới (hoặc reset password nếu đã tồn tại) MỘT tài khoản Admin duy nhất
 * theo email chỉ định — KHÔNG đụng tới bất kỳ user hay data nào khác. Dùng
 * để: tạo thêm admin phụ, hoặc tự cứu khi tài khoản admin bị khoá/quên pass.
 *
 * Cách chạy (trong container):
 *   docker compose exec app sh -c \
 *     "ADMIN_EMAIL=admin@domain.com npx tsx prisma/create-admin.ts"
 *
 * (Bản cũ của file này tạo cứng "admin@company.com" / password
 * "Admin@123456" — đã thay bằng bản tham số hoá + password random, an toàn
 * hơn cho production.)
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password-hash";
import crypto from "crypto";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || "Admin";

function generateRandomPassword(length = 16) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[crypto.randomInt(0, chars.length)];
  }
  return password;
}

async function main() {
  if (!ADMIN_EMAIL) {
    console.error(
      "\nThiếu ADMIN_EMAIL. Ví dụ:\n" +
        "  ADMIN_EMAIL=admin@domain.com npx tsx prisma/create-admin.ts\n"
    );
    process.exit(1);
  }

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin" },
  });

  const newPassword = generateRandomPassword(16);
  const hashedPassword = await hashPassword(newPassword);

  const existed = await prisma.user.findUnique({
    where: { username: ADMIN_EMAIL },
  });

  await prisma.user.upsert({
    where: { username: ADMIN_EMAIL },
    update: {
      roleId: adminRole.id,
      password: hashedPassword,
      mustChangePassword: true,
    },
    create: {
      username: ADMIN_EMAIL,
      fullName: ADMIN_FULL_NAME,
      roleId: adminRole.id,
      password: hashedPassword,
      mustChangePassword: true,
    },
  });

  console.log("\n=== HOÀN TẤT ===");
  console.log(
    existed
      ? "Đã reset password cho tài khoản có sẵn:"
      : "Đã tạo tài khoản Admin mới:"
  );
  console.log(`Email/Username: ${ADMIN_EMAIL}`);
  console.log(`Mật khẩu tạm thời: ${newPassword}`);
  console.log(
    "(Bắt buộc đổi mật khẩu ngay ở lần đăng nhập đầu tiên — lưu lại mật khẩu này trước khi đóng terminal.)\n"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });