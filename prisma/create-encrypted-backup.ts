// Script chạy qua cron trên VPS (xem scripts/backup-db.sh) — gọi lại ĐÚNG
// logic createBackup() dùng chung với nút "Tạo backup ngay" trong Cài đặt >
// Backup & Restore, để backup tạo tự động hằng ngày cũng được mã hoá
// AES-256-GCM giống hệt (cùng 1 khoá BACKUP_ENCRYPTION_KEY, IV ngẫu nhiên
// riêng mỗi file) thay vì phải cài lại logic mã hoá riêng bằng bash/openssl
// (dễ lệch định dạng, khó bảo trì đồng bộ với code TypeScript).
//
// Chạy: docker compose exec -T app npx tsx prisma/create-encrypted-backup.ts
import { createBackup } from "../src/modules/backup/backup.service";

async function main() {
  const info = await createBackup("Cron tự động (VPS)");
  console.log(`Backup thành công: ${info.name} (${info.sizeBytes} bytes)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Tạo backup thất bại:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
