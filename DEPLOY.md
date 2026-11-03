# Deploy ITAMS lên VPS (Docker)

## 0. Yêu cầu trên VPS

- Docker + Docker Compose plugin đã cài (`docker --version`, `docker compose version`).
- Domain hoặc IP để truy cập, mở port 80/443 (và 3000 nếu test trực tiếp chưa qua Nginx).

## 1. Đưa code lên VPS

```bash
# Trên VPS
git clone <repo-url> itams
cd itams
```

(Nếu chưa dùng git, có thể `scp -r` cả thư mục project lên, nhớ **không** copy file `.env` cũ từ máy dev.)

## 2. Tạo file môi trường production

```bash
cp .env.production.example .env
```

Điền vào `.env.production`:

- `POSTGRES_PASSWORD`: đặt 1 chuỗi mạnh, random.
- `WT_SECRET`: tạo bằng lệnh `openssl rand -hex 32`, dán vào. **Phải khác** secret đang dùng ở máy dev.
- `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`: thông tin email dùng để gửi password cho user mới (nếu dùng Gmail, tạo App Password 16 ký tự, không dùng password Gmail thường).
- `DATABASE_URL`: nếu dùng đúng `docker-compose.yml` kèm theo (Postgres chạy trong container tên `db`), giữ nguyên dạng `postgresql://itams_user:<POSTGRES_PASSWORD>@db:5432/itams_db` — chỉ cần thay đúng password đã đặt ở trên.

## 3. Build & chạy

```bash
docker compose build
docker compose up -d
```

Container `app` khi khởi động sẽ tự chạy `prisma migrate deploy` (áp toàn bộ migration) rồi mới start server — xem log bằng:

```bash
docker compose logs -f app
```

Truy cập thử: `http://<IP-VPS>:3000`

## 4. Xoá data demo, tạo tài khoản Admin thật

**Chỉ chạy 1 lần, sau khi đã chắc chắn migrate xong.** Lệnh này xoá toàn bộ Employee (nhân viên), Asset (thiết bị) và mọi thứ gắn theo thiết bị (lịch sử, phụ kiện, bảo hành, phiếu nhập/xuất), cùng mọi User khác — **giữ nguyên** Warehouse (kho), Model Code/Category, Team/Position/Vendor/MasterOption, chỉ còn đúng 1 tài khoản Admin.

```bash
docker compose exec app sh -c "CONFIRM_RESET=YES ADMIN_EMAIL=taitrinh3373@gmail.com npx tsx prisma/reset-for-production.ts"
```

Script sẽ in ra **mật khẩu tạm thời** của tài khoản Admin — lưu lại ngay, mật khẩu này chỉ hiện ra đúng 1 lần trong log. Đăng nhập bằng tài khoản đó, hệ thống sẽ bắt buộc đổi mật khẩu ngay (tính năng "đổi mật khẩu lần đầu" đã làm ở phần trước).

## 5. Gắn domain + HTTPS (khuyến nghị, không bắt buộc để chạy thử)

Cài Nginx trên VPS (ngoài container) làm reverse proxy + Certbot cho SSL:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Rồi: `sudo certbot --nginx -d your-domain.com`

## 6. Cập nhật code sau này (deploy bản mới)

```bash
git pull
docker compose build
docker compose up -d
```

Migration mới (nếu có) sẽ tự chạy lại qua entrypoint, an toàn để chạy nhiều lần (`migrate deploy` bỏ qua migration đã áp dụng rồi).

## Backup database (nên làm định kỳ)

```bash
docker compose exec db pg_dump -U itams_user itams_db > backup-$(date +%F).sql
```

## Lưu ý quan trọng

- File `Dockerfile` / `docker-compose.yml` được viết theo chuẩn Next.js standalone output + Prisma, nhưng **chưa build-test được** trong môi trường chuẩn bị việc này (sandbox không có Docker) — khi bạn `docker compose build` lần đầu, nếu gặp lỗi, gửi lại log để mình fix tiếp.
- Không commit `.env.production` lên git (đã có trong `.gitignore`).
- Script `prisma/reset-for-production.ts` xoá dữ liệu **vĩnh viễn, không hoàn tác được** — chỉ chạy khi chắc chắn.
