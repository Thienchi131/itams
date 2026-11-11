/**
 * Tạo mới (hoặc reset password nếu đã tồn tại) MỘT tài khoản với role bất kỳ
 * (Admin / IT / User) — an toàn chạy trên production, KHÔNG đụng tới bất kỳ
 * user hay data nào khác.
 *
 * Dùng script này thay vì trang "Tạo tài khoản" trong lúc SMTP trên VPS còn
 * bị chặn port — mật khẩu được in thẳng ra terminal thay vì gửi email.
 *
 * Cách chạy (trong container):
 *   docker compose exec app sh -c \
 *     "USER_EMAIL=it@demo.com USER_FULL_NAME='IT Staff' USER_ROLE=IT npx tsx prisma/create-user.ts"
 *
 * USER_ROLE nhận 1 trong 3 giá trị: Admin | IT | User
 * USER_REGION_NAME (tuỳ chọn): tên khu vực (Region) để giới hạn tài khoản
 *   chỉ thấy các kho thuộc khu vực đó (VD: Dubai). Bỏ qua = tài khoản thấy
 *   toàn bộ kho. Xem/tạo khu vực tại Cài đặt > Khu vực trong app.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password-hash";
import crypto from "crypto";

const prisma = new PrismaClient();

const USER_EMAIL = (process.env.USER_EMAIL || "").trim().toLowerCase();
const USER_FULL_NAME = process.env.USER_FULL_NAME || "";
const USER_ROLE = process.env.USER_ROLE || "";
const USER_REGION_NAME = (process.env.USER_REGION_NAME || "").trim();

const VALID_ROLES = ["Admin", "IT", "User"];

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
  if (!USER_EMAIL || !USER_FULL_NAME || !USER_ROLE) {
    console.error(
      "\nThiếu tham số. Ví dụ:\n" +
        "  USER_EMAIL=it@demo.com USER_FULL_NAME='IT Staff' USER_ROLE=IT npx tsx prisma/create-user.ts\n"
    );
    process.exit(1);
  }

  if (!VALID_ROLES.includes(USER_ROLE)) {
    console.error(`\nUSER_ROLE không hợp lệ: "${USER_ROLE}". Chỉ nhận: ${VALID_ROLES.join(" | ")}\n`);
    process.exit(1);
  }

  const role = await prisma.role.upsert({
    where: { name: USER_ROLE },
    update: {},
    create: { name: USER_ROLE },
  });

  let regionId: number | null = null;

  if (USER_REGION_NAME) {
    const region = await prisma.region.findUnique({
      where: { name: USER_REGION_NAME },
    });

    if (!region) {
      console.error(`\nKhông tìm thấy khu vực có tên "${USER_REGION_NAME}".\n`);
      process.exit(1);
    }

    regionId = region.id;
  }

  const newPassword = generateRandomPassword(16);
  const hashedPassword = await hashPassword(newPassword);

  const existed = await prisma.user.findUnique({
    where: { username: USER_EMAIL },
  });

  await prisma.user.upsert({
    where: { username: USER_EMAIL },
    update: {
      fullName: USER_FULL_NAME,
      roleId: role.id,
      regionId,
      password: hashedPassword,
      mustChangePassword: true,
    },
    create: {
      username: USER_EMAIL,
      fullName: USER_FULL_NAME,
      roleId: role.id,
      regionId,
      password: hashedPassword,
      mustChangePassword: true,
    },
  });

  console.log("\n=== HOÀN TẤT ===");
  console.log(
    existed ? "Đã reset password cho tài khoản có sẵn:" : "Đã tạo tài khoản mới:"
  );
  console.log(`Email/Username: ${USER_EMAIL}`);
  console.log(`Họ tên: ${USER_FULL_NAME}`);
  console.log(`Role: ${USER_ROLE}`);
  console.log(`Khu vực: ${USER_REGION_NAME || "Tất cả (không giới hạn)"}`);
  console.log(`Mật khẩu tạm thời: ${newPassword}`);
  console.log(
    "(Bắt buộc đổi mật khẩu ngay ở lần đăng nhập đầu tiên — hãy lưu lại mật khẩu này trước khi đóng terminal.)\n"
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
