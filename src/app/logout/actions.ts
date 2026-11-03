"use server";

import { logout } from "@/modules/auth/auth.service";

// Đăng xuất PHẢI là một Server Action (POST) chứ không phải Link GET —
// Next.js tự động prefetch mọi <Link> xuất hiện trên màn hình, nếu route
// logout là GET và tự xoá cookie ngay trong lúc xử lý thì chỉ cần link đó
// hiện trên sidebar là bị prefetch âm thầm xoá session, gây hiện tượng
// "tự nhiên bị đăng xuất" dù chưa hề bấm gì.
export async function logoutAction() {
  await logout();
}
