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
  // các API trình duyệt nhạy cảm (camera/mic/geolocation) mà app này không
  // dùng tới. Không thêm Strict-Transport-Security ở đây vì site hiện chạy
  // HTTP thuần (chưa gắn SSL) — bật HSTS trước khi có HTTPS sẽ khiến trình
  // duyệt từ chối kết nối lại qua HTTP, tự làm sập truy cập của chính mình.
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
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
