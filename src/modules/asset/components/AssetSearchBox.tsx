"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function AssetSearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";

  const [keyword, setKeyword] = useState(currentQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đồng bộ lại ô input nếu param "q" trên URL đổi từ nơi khác (VD: bấm link
  // xoá bộ lọc) — không tự bắn request tìm kiếm ở đây, chỉ cập nhật hiển thị.
  useEffect(() => {
    setKeyword(currentQ);
  }, [currentQ]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setKeyword(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // QUAN TRỌNG: trước đây logic debounce này nằm trong useEffect phụ
    // thuộc cả `searchParams` — nên mỗi lần chuyển trang (bấm "Sau" sang
    // page=2/3/...) làm searchParams đổi cũng vô tình kích hoạt lại effect,
    // tự động xoá page khỏi URL và kéo người dùng về trang 1 dù họ không hề
    // gõ tìm kiếm gì. Giờ chỉ điều hướng khi CHÍNH người dùng gõ (trong
    // handler này), và đọc URL hiện tại trực tiếp từ window lúc bắn request
    // (không phụ thuộc searchParams) để tránh trigger lại ngoài ý muốn.
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);

      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }

      // Đổi từ khoá tìm kiếm thì phải quay về trang 1 — giữ nguyên
      // page=2/3/... cũ sẽ tra vào 1 trang không tồn tại của tập kết quả
      // mới (thường ít hơn), làm bảng trống trơn dù có kết quả thật ở trang 1.
      params.delete("page");

      router.push(`/assets?${params.toString()}`);
    }, 500);
  }

  return (
    <input
      value={keyword}
      onChange={handleChange}
      className="w-full rounded-lg border px-4 py-3 text-sm"
      placeholder="Tìm theo Asset Tag, Serial, thiết bị hoặc người dùng..."
    />
  );
}