"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Lọc theo CÓ 1 phụ kiện đi kèm (Adapter hoặc Cáp sạc) — dùng chung 1
// component cho cả 2 cột vì logic giống hệt nhau, chỉ khác tên query param
// ("adapter"/"cable") và nhãn hiển thị. Chỉ 1 ô tick duy nhất: TICK = chỉ
// lọc thiết bị CÓ phụ kiện này (param=yes); KHÔNG TICK = không lọc theo cột
// này, hiện tất cả (không gửi param).
//
// KHÔNG tự bọc khung/border riêng — 2 instance (Adapter/Cáp sạc) được gộp
// chung 1 khung pill duy nhất ở page.tsx (thay vì mỗi cái 1 khung riêng như
// trước) để đỡ chiếm bề ngang, dễ nằm gọn cùng 1 dòng với các dropdown lọc
// khác.
export default function AccessoryFilterSelect({
  paramName,
  label,
  icon,
  selectedValue,
}: {
  paramName: "adapter" | "cable";
  label: string;
  icon: React.ReactNode;
  selectedValue: "yes" | "no" | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());

    if (selectedValue === "yes") {
      params.delete(paramName);
    } else {
      params.set(paramName, "yes");
    }
    // Đổi filter thì reset về trang 1 — tránh đứng ở trang lẻ vượt quá tổng
    // số trang của tập kết quả mới.
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={selectedValue === "yes"}
        onChange={toggle}
        className="h-4 w-4 accent-emerald-600"
      />
      <span className="text-blue-500">{icon}</span>
      {label}
    </label>
  );
}
