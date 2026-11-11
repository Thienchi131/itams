/**
 * Mã hoá (AES-256-GCM, khoá PASSWORD_ENCRYPTION_KEY) toàn bộ chuỗi băm mật
 * khẩu bcrypt cũ trong bảng User — chạy 1 lần sau khi thêm khoá vào .env.
 * KHÔNG đổi mật khẩu của ai: chỉ bọc thêm 1 lớp mã hoá quanh chuỗi băm sẵn
 * có, mọi người vẫn đăng nhập bằng mật khẩu cũ. Chạy lại nhiều lần an toàn
 * (bỏ qua dòng đã mã hoá). Xem src/lib/password-hash.ts.
 *
 * Cách chạy (trong container):
 *   docker compose exec app npx tsx prisma/encrypt-password-hashes.ts            # xem trước
 *   docker compose exec app sh -c "CONFIRM=YES npx tsx prisma/encrypt-password-hashes.ts"
 */

import { PrismaClient } from "@prisma/client";
import { encryptPasswordHash, isEncryptedPasswordHash } from "../src/lib/password-hash";

const prisma = new PrismaClient();

async function main() {
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.PASSWORD_ENCRYPTION_KEY?.trim() ?? "")) {
    throw new Error("Chưa có PASSWORD_ENCRYPTION_KEY hợp lệ (64 ký tự hex) trong .env — dừng.");
  }
  if (process.env.PASSWORD_ENCRYPTION_KEY === process.env.BACKUP_ENCRYPTION_KEY) {
    throw new Error("PASSWORD_ENCRYPTION_KEY phải KHÁC BACKUP_ENCRYPTION_KEY — dừng.");
  }

  const users = await prisma.user.findMany({ select: { id: true, username: true, password: true } });
  const pending = users.filter((u) => !isEncryptedPasswordHash(u.password));

  console.log(`Tổng ${users.length} tài khoản — ${users.length - pending.length} đã mã hoá, ${pending.length} cần mã hoá.`);

  if (process.env.CONFIRM !== "YES") {
    console.log('Chế độ xem trước — chạy lại với CONFIRM=YES để mã hoá thật.');
    return;
  }

  for (const user of pending) {
    // Chỉ cập nhật nếu chuỗi chưa bị đổi trong lúc chạy (VD user vừa đổi mật khẩu).
    await prisma.user.updateMany({
      where: { id: user.id, password: user.password },
      data: { password: encryptPasswordHash(user.password) },
    });
  }

  console.log(`Đã mã hoá ${pending.length} tài khoản.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
