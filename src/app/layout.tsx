import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import FlashToast from "./components/FlashToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ITAMS",
  description: "IT Asset Management System",
  // iPhone: "Thêm vào Màn hình chính" dùng tên + icon này và mở toàn màn
  // hình (không thanh địa chỉ). Manifest ở src/app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: "ITAMS",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: {
    // Không tự biến serial/số máy thành link gọi điện trên iPhone.
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#3E74E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
