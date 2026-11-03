# --- Stage 1: install deps + build ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# openssl cần cho Prisma engine trên Debian slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Sinh Prisma Client khớp schema hiện tại trước khi build Next.js.
# `prisma generate` chỉ đọc schema.prisma để sinh code, KHÔNG thực sự kết
# nối DB — nên chỉ cần 1 giá trị giả để thoả điều kiện cấu hình lúc build.
# DATABASE_URL thật (bí mật) chỉ được truyền vào lúc container CHẠY qua
# docker-compose (đọc từ .env trên VPS), không hề nằm trong image.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

RUN npm run build

# --- Stage 2: chỉ copy phần cần thiết để chạy, image gọn nhẹ ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# postgresql-client-16: cần cho pg_dump/psql — dùng bởi tính năng
# Backup/Restore trong Cài đặt (chạy trực tiếp bên trong container app, kết
# nối sang service "db" qua network nội bộ Docker, không cần docker
# socket/exec từ host). BẮT BUỘC đúng major version 16 khớp với ảnh
# "postgres:16-alpine" đang dùng cho service "db" — gói "postgresql-client"
# mặc định của Debian bookworm chỉ có v15, pg_dump v15 sẽ THẲNG THỪNG TỪ CHỐI
# dump từ server v16 ("aborting because of server version mismatch"), không
# phải cảnh báo suông mà là lỗi cứng. Phải thêm repo chính thức PGDG mới lấy
# được đúng gói v16.
RUN apt-get update -y \
  && apt-get install -y openssl gnupg curl ca-certificates \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update -y \
  && apt-get install -y postgresql-client-16 \
  && apt-get purge -y gnupg curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# --chown=nextjs:nodejs bắt buộc phải có ở đây (trước đây thiếu, khác 2 dòng
# COPY bên dưới) — nếu không, file trong public/ giữ nguyên owner "root" từ
# stage build, và nếu file nguồn trên máy host có quyền hạn chế (VD: 600,
# chỉ chủ mới đọc được) thì process "nextjs" (uid 1001) không đọc nổi, gây
# lỗi 500 khi Next.js cố serve static file đó (từng gặp với login-sky.jpg).
# Thêm chmod để đảm bảo luôn đọc được dù file nguồn trên host có quyền gì.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN chmod -R a+rX ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Custom server (thay cho server.js Next.js tự sinh trong .next/standalone) —
# đọc IP thật từ socket TCP + chặn IP không nằm trong whitelist khi được bật.
# Xem ghi chú đầy đủ trong chính file này.
COPY --from=builder --chown=nextjs:nodejs /app/server-with-ip-whitelist.js ./server-with-ip-whitelist.js

# Cần cho lệnh `npx prisma migrate deploy` chạy được lúc deploy. Copy
# nguyên node_modules (thay vì chọn lọc từng thư mục) vì CLI `prisma` kéo
# theo khá nhiều dependency phụ (vd: package "effect") mà nếu chọn thiếu sẽ
# lỗi MODULE_NOT_FOUND lúc chạy.
# --chown=nextjs:nodejs + chmod BẮT BUỘC phải có ở đây (từng thiếu, gây sập
# prod 2026-08-29: "EACCES: permission denied, open '/app/prisma/schema.prisma'").
# Lý do giống hệt ghi chú ở public/ phía trên: thiếu --chown khiến thư mục
# prisma/ trong image giữ nguyên owner "root" từ stage build, và nếu file
# nguồn trên host (VD schema.prisma, migration.sql mới) có quyền hạn chế
# (600, chỉ chủ mới đọc được) thì process "nextjs" (uid 1001, KHÔNG phải
# root) không đọc nổi -> lệnh `npx prisma migrate deploy` lúc container khởi
# động lỗi EACCES ngay khi mở schema.prisma, container crash-loop liên tục.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
RUN chmod -R a+rX ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Cần cho prisma/create-encrypted-backup.ts (chạy qua "npx tsx" lúc cron gọi
# scripts/backup-db.sh) — script này import trực tiếp từ
# src/modules/backup/backup.service.ts (và file đó import tiếp
# src/modules/audit/audit-log.service.ts qua alias "@/..."), là code TypeScript
# NGUỒN chứ không phải code đã build vào .next/standalone, nên phải copy
# nguyên thư mục src/ + tsconfig.json (để tsx biết resolve alias "@/*" ->
# "./src/*") vào image runner thì mới chạy được. Thiếu 2 dòng này sẽ gây lỗi
# "Cannot find module '../src/modules/backup/backup.service'".
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
