import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build ra 1 thư mục gọn (.next/standalone) chỉ chứa đúng code + deps cần
  // thiết để chạy, dùng cho Docker image nhẹ hơn nhiều so với node_modules
  // đầy đủ.
  output: "standalone",

  experimental: {
    serverActions: {
      // Mặc định Server Action chỉ nhận tối đa 1MB — quá nhỏ để tính năng
      // Khôi phục (Cài đặt > Backup & Restore) nhận file .sql.gz upload từ
      // máy người dùng. Nới lên 100MB, đủ dư cho quy mô dữ liệu hiện tại lẫn
      // tăng trưởng nhiều năm tới.
      bodySizeLimit: "100mb",
    },
  },

  // Trước đây không set header bảo mật nào — thêm 1 lớp phòng thủ chuẩn cho
  // mọi response: chặn clickjacking (X-Frame-Options/frame-ancestors), chặn
  // MIME-sniffing, hạn chế thông tin Referrer rò ra domain khác, và tắt bớt
  // các API trình duyệt nhạy cảm (mic/geolocation) mà app này không dùng tới.
  // Camera: chỉ cho CHÍNH site này dùng (trang /scan quét QR/mã vạch bằng
  // ZXing qua getUserMedia) — "camera=()" trước đây chặn cả chính site, chỉ
  // chạy được trên Safari iPhone vì Safari bỏ qua header này; Chrome/Edge
  // (Android, máy tính) sẽ từ chối mở camera. "(self)" vẫn chặn iframe/site
  // khác nhúng vào. Strict-Transport-Security (HSTS) được set ở tầng nginx
  // (block listen 443) chứ không ở đây: HSTS chỉ nên gửi trên HTTPS, mà nginx
  // mới là nơi phân biệt 80/443 — cổng 80 đã chuyển sang 301 -> 443. Xem
  // itam.applesmng.com.nginx.conf.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
