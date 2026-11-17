"use client";

import { useEffect } from "react";

// Xoá cờ "đã nhắc" mỗi khi vào trang đăng nhập -> lần đăng nhập kế tiếp sẽ
// hiện lại popup nhắc việc (LoginReminders). Bao mọi đường tới /login: đăng
// xuất, hết phiên bị đá ra, hoặc mở tab mới.
export default function ClearLoginRemindersFlag() {
  useEffect(() => {
    try {
      sessionStorage.removeItem("itamsLoginRemindersShown");
    } catch {}
  }, []);
  return null;
}
