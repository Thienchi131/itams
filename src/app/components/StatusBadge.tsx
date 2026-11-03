import { AssetStatus } from "@prisma/client";

// size="sm" (mặc định) — dùng ở trang chi tiết tài sản (/assets/[id]),
// đứng cạnh mã Asset Tag cỡ text-sm ở đầu trang, cần cùng cỡ chữ cho cân.
// size="xs" — dùng ở bảng Quản lý tài sản (/assets), cột "Trạng thái" hẹp
// hơn nhiều so với trang chi tiết; text-sm trước đây khiến nhãn dài (VD
// "Đang sử dụng") vỡ xuống 2 dòng, to lệch hẳn so với các badge khác cùng
// hàng (Kho, Tag đều text-xs) — xem yêu cầu "cân chỉnh kích thước cho đẹp".
export default function StatusBadge({
  status,
  size = "sm",
}: {
  status: AssetStatus | string;
  size?: "sm" | "xs";
}) {
  const config: Record<string, string> = {
    IN_STOCK: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    ASSIGNED: "bg-blue-100 text-blue-700 ring-blue-200",
    REPAIR: "bg-orange-100 text-orange-700 ring-orange-200",
    RETIRED: "bg-slate-100 text-slate-700 ring-slate-200",
    LOST: "bg-red-100 text-red-700 ring-red-200",
    // Cùng tông tím với icon Truck/nút "Luân chuyển kho" ở trang chi tiết
    // thiết bị, để nhận ra ngay đây là badge liên quan tới luân chuyển.
    IN_TRANSIT: "bg-violet-100 text-violet-700 ring-violet-200",
  };

  const label: Record<string, string> = {
    IN_STOCK: "Trong kho",
    ASSIGNED: "Đang sử dụng",
    REPAIR: "Bảo trì",
    RETIRED: "Chờ thanh lý",
    LOST: "Mất",
    IN_TRANSIT: "Đang luân chuyển",
  };

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 font-bold ring-1 ${
        size === "xs" ? "text-xs" : "text-sm"
      } ${config[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}
    >
      {label[status] ?? status}
    </span>
  );
}