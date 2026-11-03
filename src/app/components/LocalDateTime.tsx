"use client";

import { useEffect, useState } from "react";

type Mode = "date" | "datetime";

function format(value: string | Date, mode: Mode, timeZone?: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const options: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};

  return mode === "datetime"
    ? date.toLocaleString("vi-VN", options)
    : date.toLocaleDateString("vi-VN", options);
}

/**
 * Hiển thị ngày/giờ theo đúng múi giờ của THIẾT BỊ đang xem (trình duyệt),
 * thay vì giờ server (VPS) — cần thiết vì hệ thống có user ở nhiều quốc gia
 * khác nhau (Lào, Thái, Campuchia, Dubai, Việt Nam, Philippines, Malaysia,
 * Sri Lanka, Georgia, Nigeria, Bangladesh...), server chỉ chạy 1 múi giờ cố
 * định nên không thể đúng cho tất cả mọi người cùng lúc nếu render ở server.
 *
 * Lần render đầu tiên (SSR + trước khi hydrate xong ở client) dùng giờ UTC
 * cố định — giống nhau tuyệt đối giữa server và client nên không gây lỗi
 * hydration mismatch của React. Ngay sau khi mount xong ở trình duyệt,
 * useEffect sẽ cập nhật lại đúng theo múi giờ thật của thiết bị.
 */
export default function LocalDateTime({
  value,
  mode = "date",
}: {
  value: string | Date;
  mode?: Mode;
}) {
  const [text, setText] = useState(() => format(value, mode, "UTC"));

  useEffect(() => {
    setText(format(value, mode));
  }, [value, mode]);

  return <>{text}</>;
}
