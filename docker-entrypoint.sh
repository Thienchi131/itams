#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

# Trên 1 VPS mới, DB khởi tạo trống trơn — migration chỉ tạo cấu trúc bảng,
# KHÔNG tự điền sẵn danh mục (Kho, MasterOption). Trước đây phải seed thủ
# công sau khi deploy (dễ quên, từng gây mất kho ở lần deploy này). 2 script
# dưới đây dùng upsert (idempotent) và KHÔNG đụng tới Employee/Asset/User —
# an toàn để chạy lại mỗi lần container khởi động, kể cả trên DB đã có data.
echo "Ensuring reference data (warehouses, master options)..."
npx tsx prisma/seed-warehouses.ts
npx tsx prisma/seed-master-options.ts

echo "Starting ITAMS..."
# Dùng custom server (thay vì server.js Next.js tự sinh) để đọc IP thật từ
# socket TCP + enforce whitelist IP toàn hệ thống nếu tính năng được bật ở
# Cài đặt > Whitelist IP — xem ghi chú trong server-with-ip-whitelist.js.
exec node server-with-ip-whitelist.js
