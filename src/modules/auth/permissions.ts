export const ROLE_ADMIN = "Admin";
export const ROLE_IT = "IT";
export const ROLE_USER = "User";

export type MenuKey =
  | "dashboard"
  | "assets"
  | "models"
  | "supplies"
  | "employees"
  | "reports"
  | "users"
  | "settings";

// Admin: toàn bộ menu + toàn bộ thao tác.
// IT: mọi menu trừ Quản lý tài khoản + Cài đặt; dữ liệu bị giới hạn theo kho
//     phụ trách (xem module notification/dashboard/assets/employees để biết
//     chỗ áp dụng warehouseId).
// User (viewer): Dashboard + Quản lý tài sản + Quản lý nhân viên, không
//     tạo/sửa/xoá được gì, cũng bị giới hạn theo kho được gán.
const MENU_ACCESS: Record<MenuKey, string[]> = {
  dashboard: [ROLE_ADMIN, ROLE_IT, ROLE_USER],
  assets: [ROLE_ADMIN, ROLE_IT, ROLE_USER],
  // Model Library là dữ liệu gốc dùng chung cho toàn hệ thống (định nghĩa
  // cấu hình model) — mọi role đều XEM được (tham khảo cấu hình khi nhập
  // kho/tra cứu), nhưng chỉ Admin mới có quyền Thêm/Sửa/Xoá/Gộp model (xem
  // gate riêng ở models/page.tsx, models/new, models/[id], models/actions.ts).
  models: [ROLE_ADMIN, ROLE_IT, ROLE_USER],
  // Viewer (User) xem được Vật tư (giống Assets/Employees) nhưng không
  // nhập/xuất/sửa được — canEditData() vẫn chặn các thao tác ghi ở từng
  // trang/action bên trong (xem supplies/page.tsx, supplies/[id]/page.tsx).
  supplies: [ROLE_ADMIN, ROLE_IT, ROLE_USER],
  employees: [ROLE_ADMIN, ROLE_IT, ROLE_USER],
  // Báo cáo Nhập/Xuất theo kỳ — cho cả 3 role xem (kế toán/FC dùng role User
  // để tra cứu, giống lý do /activity mở cho mọi role đã áp dụng trước đó),
  // không có thao tác ghi nào ở trang này nên không cần canEditData().
  reports: [ROLE_ADMIN, ROLE_IT, ROLE_USER],
  users: [ROLE_ADMIN],
  // Cài đặt gồm toàn cấu hình hệ thống nhạy cảm (Kho, Khu vực, Whitelist
  // IP...) — trước đây IT cũng thấy menu này dù hầu hết card bên trong đã bị
  // khoá riêng cho Admin, nay thu hẹp lại: chỉ Admin thấy cả menu.
  settings: [ROLE_ADMIN],
};

export function canAccessMenu(roleName: string, menu: MenuKey): boolean {
  return MENU_ACCESS[menu]?.includes(roleName) ?? false;
}

// Có được tạo/sửa/xoá dữ liệu không (Admin + IT). User chỉ xem.
export function canEditData(roleName: string): boolean {
  return roleName === ROLE_ADMIN || roleName === ROLE_IT;
}

// Trang "an toàn" để đá về khi role không có quyền vào 1 trang cụ thể —
// tránh vòng lặp redirect nếu chính trang đó (VD "/") cũng bị chặn.
export function getDefaultRouteForRole(roleName: string): string {
  return canAccessMenu(roleName, "dashboard") ? "/" : "/assets";
}
