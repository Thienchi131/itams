import type { MetadataRoute } from "next";

// Web App Manifest — cho phép "Thêm vào Màn hình chính" (iPhone: Safari >
// Chia sẻ > Thêm vào MH chính; Android: Chrome tự gợi ý cài đặt). Mở từ biểu
// tượng thì chạy toàn màn hình như app, không có thanh địa chỉ trình duyệt.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ITAMS — IT Asset Management",
    short_name: "ITAMS",
    description: "Quản lý tài sản IT: tra cứu, cấp phát, thu hồi, quét mã thiết bị.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f8fc",
    theme_color: "#3E74E8",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Quét mã thiết bị", short_name: "Quét mã", url: "/scan" },
      { name: "Quản lý tài sản", short_name: "Tài sản", url: "/assets" },
    ],
  };
}
