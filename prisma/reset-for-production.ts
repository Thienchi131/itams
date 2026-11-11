/**
 * Xoá data NHÂN VIÊN và THIẾT BỊ để chuẩn bị lên production, GIỮ LẠI:
 *   - Warehouse (danh sách kho)
 *   - AssetModel + AssetCategory (danh sách Model Code)
 *   - Team, Position, Vendor, MasterOption (dữ liệu tham chiếu/danh mục)
 *   - Bảng Role (Admin/IT/User) — bắt buộc phải có để hệ thống chạy được.
 *   - Đúng 1 tài khoản Admin (mặc định: taitrinh3373@gmail.com).
 *
 * Bị xoá sạch: Employee (nhân viên), Asset (thiết bị) và mọi thứ gắn theo
 * thiết bị (lịch sử, phụ kiện, bảo hành, phiếu nhập/xuất, lượt bàn giao),
 * cùng toàn bộ User khác ngoài Admin nói trên.
 *
 * AN TOÀN: script này KHÔNG chạy nếu thiếu biến môi trường xác nhận, để
 * tránh bấm nhầm trên production.
 *
 * Cách chạy:
 *   CONFIRM_RESET=YES ADMIN_EMAIL=taitrinh3373@gmail.com npx tsx prisma/reset-for-production.ts
 *
 * (ADMIN_EMAIL có thể bỏ qua nếu muốn dùng đúng mặc định taitrinh3373@gmail.com)
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password-hash";
import crypto from "crypto";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "taitrinh3373@gmail.com")
  .trim()
  .toLowerCase();
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
  if (process.env.CONFIRM_RESET !== "YES") {
    console.error(
      "\nDỪNG LẠI: script này sẽ XOÁ TOÀN BỘ nhân viên, thiết bị, lịch sử,\n" +
        "và mọi User khác ngoài Admin — không thể hoàn tác.\n" +
        "Nếu chắc chắn muốn chạy, set biến môi trường CONFIRM_RESET=YES.\n\n" +
        "Ví dụ:\n" +
        "  CONFIRM_RESET=YES npx tsx prisma/reset-for-production.ts\n"
    );
    process.exit(1);
  }

  console.log(`Sẽ giữ lại đúng 1 tài khoản Admin: ${ADMIN_EMAIL}`);
  console.log("Sẽ giữ nguyên: Warehouse, Model Code, Category, Team, Position, Vendor, MasterOption.");
  console.log("Bắt đầu xoá data nhân viên + thiết bị...\n");

  // Xoá theo thứ tự con -> cha để không vướng foreign key.
  await prisma.assetHistory.deleteMany();
  console.log("- Đã xoá AssetHistory");

  await prisma.assetAssignment.deleteMany();
  console.log("- Đã xoá AssetAssignment");

  await prisma.assetAccessory.deleteMany();
  console.log("- Đã xoá AssetAccessory");

  await prisma.assetWarranty.deleteMany();
  console.log("- Đã xoá AssetWarranty");

  await prisma.stockInItem.deleteMany();
  await prisma.stockOutItem.deleteMany();
  console.log("- Đã xoá StockInItem / StockOutItem");

  await prisma.stockInSlip.deleteMany();
  await prisma.stockOutSlip.deleteMany();
  console.log("- Đã xoá StockInSlip / StockOutSlip");

  await prisma.asset.deleteMany();
  console.log("- Đã xoá Asset");

  await prisma.employee.deleteMany();
  console.log("- Đã xoá Employee");

  // Giữ nguyên: Warehouse, AssetModel, AssetCategory, Team, Position,
  // Vendor, MasterOption — theo yêu cầu chỉ xoá data nhân viên/thiết bị.

  // Users: xoá hết, chỉ chừa/tạo lại đúng 1 Admin.
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin" },
  });
  // Đảm bảo IT / User vẫn tồn tại để tạo tài khoản mới sau này không lỗi.
  await prisma.role.upsert({
    where: { name: "IT" },
    update: {},
    create: { name: "IT" },
  });
  await prisma.role.upsert({
    where: { name: "User" },
    update: {},
    create: { name: "User" },
  });

  await prisma.user.deleteMany({
    where: { username: { not: ADMIN_EMAIL } },
  });
  console.log(`- Đã xoá mọi User khác, chỉ giữ ${ADMIN_EMAIL}`);

  const newPassword = generateRandomPassword(16);
  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.upsert({
    where: { username: ADMIN_EMAIL },
    update: {
      fullName: ADMIN_FULL_NAME,
      roleId: adminRole.id,
      regionId: null,
      warehouseId: null,
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
  console.log(`Tài khoản Admin duy nhất: ${ADMIN_EMAIL}`);
  console.log(`Mật khẩu tạm thời:        ${newPassword}`);
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
