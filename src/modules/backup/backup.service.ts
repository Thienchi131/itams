import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createAuditLog } from "@/modules/audit/audit-log.service";

// Thư mục lưu file backup — bind-mount ra ~/itams/backups trên VPS (xem
// docker-compose.yml), CHUNG với thư mục mà scripts/backup-db.sh (chạy qua
// cron trên host) dùng, nên UI này và cron thấy chung 1 danh sách file.
export const BACKUP_DIR = path.join(process.cwd(), "backups");

// File mới (từ khi có tính năng mã hoá) có đuôi ".sql.gz.enc". File cũ tạo
// trước đó (cron chạy trước khi có bước mã hoá) vẫn còn đuôi ".sql.gz" trần
// — vẫn nhận diện/tải/khôi phục được, chỉ đơn thuần KHÔNG được mã hoá, để
// không phá vỡ các backup đã có sẵn trên VPS.
const ENCRYPTED_SUFFIX = ".sql.gz.enc";

// Chỉ chấp nhận đúng định dạng tên do createBackup() sinh ra — chặn path
// traversal (VD: "../../etc/passwd") khi tên file được truyền qua form/URL
// từ phía người dùng (dù chỉ Admin mới vào được trang này).
const FILENAME_RE = /^itams_db_\d{8}_\d{6}\.sql\.gz(\.enc)?$/;

export type BackupFileInfo = {
  name: string;
  sizeBytes: number;
  createdAt: Date;
  encrypted: boolean;
};

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatTimestamp(date: Date) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

// Bóc DATABASE_URL ("postgresql://user:pass@host:port/db") thành các biến
// PG* chuẩn của libpq — truyền qua env thay vì nhét thẳng connection string
// vào tham số dòng lệnh, vì tham số argv có thể lộ ra `ps aux`/`/proc/*/cmdline`
// cho tiến trình khác trên cùng máy đọc được, còn biến môi trường của riêng
// tiến trình con thì không.
function pgEnv(): NodeJS.ProcessEnv {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("Thiếu biến môi trường DATABASE_URL.");
  }

  const url = new URL(raw);

  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, ""),
  };
}

// --- Mã hoá AES-256-GCM ---------------------------------------------------
// Mỗi file backup được mã hoá bằng CÙNG 1 khoá bí mật (BACKUP_ENCRYPTION_KEY
// trong .env trên VPS — không nằm trong code/git/image), nhưng với 1 IV
// (initialization vector) ngẫu nhiên RIÊNG cho từng file. Đây là cách làm
// chuẩn của mọi công cụ backup có mã hoá (restic, borgbackup...): không cần
// — và không nên — dùng 1 khoá khác nhau cho mỗi file, chỉ cần IV không bao
// giờ lặp lại với cùng 1 khoá là đủ an toàn tuyệt đối cho AES-GCM. Nếu file
// backup bị lộ ra ngoài (leak), không có khoá này thì không thể giải mã được
// — kể cả biết trước nội dung là gì.
//
// Định dạng file .enc: [IV 12 byte][AUTH TAG 16 byte][CIPHERTEXT ...]
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'Thiếu biến môi trường BACKUP_ENCRYPTION_KEY trong file .env trên VPS. Tạo bằng lệnh "openssl rand -hex 32", thêm dòng BACKUP_ENCRYPTION_KEY=<chuỗi vừa tạo> vào .env rồi "docker compose up -d --build" lại.'
    );
  }

  const key = Buffer.from(raw.trim(), "hex");
  if (key.length !== 32) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY không hợp lệ — cần đúng 64 ký tự hex (32 byte). Tạo lại bằng lệnh: openssl rand -hex 32'
    );
  }

  return key;
}

function encryptBuffer(plain: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

function decryptBuffer(payload: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      "Không giải mã được file backup — sai BACKUP_ENCRYPTION_KEY (khác với lúc tạo file này), hoặc file đã bị hỏng/chỉnh sửa."
    );
  }
}

// ---------------------------------------------------------------------------

export async function listBackups(): Promise<BackupFileInfo[]> {
  await ensureBackupDir();
  const entries = await fs.readdir(BACKUP_DIR);
  const files = entries.filter((name) => FILENAME_RE.test(name));

  const infos = await Promise.all(
    files.map(async (name) => {
      const stat = await fs.stat(path.join(BACKUP_DIR, name));
      return {
        name,
        sizeBytes: stat.size,
        createdAt: stat.mtime,
        encrypted: name.endsWith(ENCRYPTED_SUFFIX),
      };
    })
  );

  return infos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function resolveBackupPath(name: string): string {
  if (!FILENAME_RE.test(name)) {
    throw new Error("Tên file backup không hợp lệ.");
  }
  return path.join(BACKUP_DIR, name);
}

// Tạo 1 bản backup mới: pg_dump (plain SQL, --clean --if-exists để tự chứa
// lệnh xoá trước khi tạo lại, --no-owner/--no-privileges để không phụ thuộc
// role cụ thể) → nén gzip → MÃ HOÁ AES-256-GCM → ghi ra file tạm rồi mới đổi
// tên (rename) sang tên thật — tránh trường hợp lỡ đọc phải file đang ghi dở
// nếu có lỗi giữa chừng (mất điện, pg_dump crash...).
export async function createBackup(actorName: string): Promise<BackupFileInfo> {
  await ensureBackupDir();

  const env = pgEnv();
  const filename = `itams_db_${formatTimestamp(new Date())}${ENCRYPTED_SUFFIX}`;
  const plainTmpPath = path.join(BACKUP_DIR, `.${filename}.plain.tmp`);
  const encTmpPath = path.join(BACKUP_DIR, `.${filename}.tmp`);
  const finalPath = path.join(BACKUP_DIR, filename);

  const dump = spawn(
    "pg_dump",
    ["--no-owner", "--no-privileges", "--clean", "--if-exists"],
    { env, stdio: ["ignore", "pipe", "pipe"] }
  );

  let stderr = "";
  dump.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitPromise = new Promise<number>((resolve, reject) => {
    dump.on("error", reject);
    dump.on("exit", (code) => resolve(code ?? 1));
  });

  try {
    await pipeline(dump.stdout, zlib.createGzip(), createWriteStream(plainTmpPath));
  } catch (err) {
    await fs.rm(plainTmpPath, { force: true });
    throw err;
  }

  const code = await exitPromise;
  if (code !== 0) {
    await fs.rm(plainTmpPath, { force: true });
    throw new Error(`pg_dump thoát với mã lỗi ${code}: ${stderr.slice(0, 2000)}`);
  }

  try {
    const gzipBuffer = await fs.readFile(plainTmpPath);
    const encrypted = encryptBuffer(gzipBuffer);
    await fs.writeFile(encTmpPath, encrypted);
    await fs.rename(encTmpPath, finalPath);
  } finally {
    await fs.rm(plainTmpPath, { force: true });
  }

  const stat = await fs.stat(finalPath);

  await createAuditLog({
    actorName,
    action: "Tạo backup database (đã mã hoá)",
    targetType: "Backup",
    targetId: filename,
    detail: `File: ${filename} — ${formatBytes(stat.size)}`,
  });

  return { name: filename, sizeBytes: stat.size, createdAt: stat.mtime, encrypted: true };
}

export async function deleteBackup(name: string, actorName: string): Promise<void> {
  const target = resolveBackupPath(name);
  await fs.rm(target, { force: true });

  await createAuditLog({
    actorName,
    action: "Xoá file backup",
    targetType: "Backup",
    targetId: name,
  });
}

function runPsqlCommand(env: NodeJS.ProcessEnv, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const psql = spawn("psql", ["--set", "ON_ERROR_STOP=1", "-c", sql], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    psql.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    psql.on("error", reject);
    psql.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(0, 2000)));
    });
  });
}

function runPsqlWithStdin(env: NodeJS.ProcessEnv, input: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const psql = spawn("psql", ["--set", "ON_ERROR_STOP=1"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    psql.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    psql.on("error", reject);
    psql.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(0, 2000)));
    });

    psql.stdin.write(input);
    psql.stdin.end();
  });
}

// Khôi phục CSDL từ 1 file backup (đã mã hoá ".sql.gz.enc" hoặc file cũ
// chưa mã hoá ".sql.gz", tự nhận diện qua đuôi file) — có thể là file đã có
// sẵn trong backups/, hoặc file mới upload lưu tạm ở đâu đó. Đây là thao tác
// PHÁ HUỶ — ghi đè toàn bộ dữ liệu hiện tại — nên:
//   1. LUÔN tự tạo 1 bản backup "an toàn" ngay trước khi làm, không cho tắt
//      bước này — có đường lùi nếu chọn nhầm file.
//   2. Xoá sạch schema "public" rồi tạo lại rỗng trước khi đổ dữ liệu vào —
//      đảm bảo kết quả khôi phục luôn "sạch" (không còn bảng/dữ liệu thừa từ
//      trước), bất kể file backup được chọn có cờ --clean hay không (kể cả
//      backup cũ tạo từ trước khi tính năng này tồn tại).
export async function restoreFromFile(
  sourcePath: string,
  actorName: string,
  opts?: { originalName?: string }
): Promise<{ safetyBackup: string }> {
  const env = pgEnv();
  const sourceLabel = opts?.originalName ?? path.basename(sourcePath);
  const isEncrypted = sourceLabel.toLowerCase().endsWith(".enc");

  const safety = await createBackup(`${actorName} (tự động, trước khi khôi phục)`);

  try {
    const rawFile = await fs.readFile(sourcePath);
    const gzipBuffer = isEncrypted ? decryptBuffer(rawFile) : rawFile;
    const sqlBuffer = zlib.gunzipSync(gzipBuffer);

    await runPsqlCommand(env, "DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await runPsqlWithStdin(env, sqlBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await createAuditLog({
      actorName,
      action: "Khôi phục database THẤT BẠI",
      targetType: "Backup",
      detail: `Nguồn: ${sourceLabel}. Lỗi: ${message.slice(0, 2000)}. Đã có backup an toàn trước đó: ${safety.name} — dùng file này để khôi phục lại nếu DB đang ở trạng thái dở dang.`,
    });

    throw new Error(
      `Khôi phục thất bại: ${message}. CSDL có thể đang ở trạng thái dở dang — dùng ngay bản backup an toàn "${safety.name}" (vừa được tự động tạo trước khi khôi phục) để khôi phục lại.`
    );
  }

  await createAuditLog({
    actorName,
    action: "Khôi phục database",
    targetType: "Backup",
    detail: `Nguồn: ${sourceLabel}. Backup an toàn trước khôi phục: ${safety.name}`,
  });

  return { safetyBackup: safety.name };
}
