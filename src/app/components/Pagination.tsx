import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

type QueryValue = string | number | boolean | undefined | null;

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Đường dẫn trang, VD "/assets" */
  basePath: string;
  /**
   * Các query param khác cần giữ nguyên khi chuyển trang (VD filter, tìm
   * kiếm...) — KHÔNG cần truyền "page", component tự set giá trị này.
   */
  query?: Record<string, QueryValue>;
};

const MAX_PAGE_BUTTONS = 5;

/**
 * Thanh phân trang dùng chung cho các trang danh sách (Tài sản, Nhân viên,
 * Hoạt động, Nhật ký thao tác, Nhật ký đăng nhập...).
 *
 * Ngoài nút "Trước"/"Sau", hiện thêm nút nhảy Trang đầu/Trang cuối + tối đa 5
 * nút số trang (cửa sổ trượt quanh trang hiện tại) để nhảy qua lại giữa các
 * trang nhanh hơn khi danh sách có rất nhiều trang (VD 372 trang) thay vì
 * phải bấm "Sau" từng trang một.
 */
export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  query = {},
}: PaginationProps) {
  const total = Math.max(totalPages || 1, 1);
  const current = Math.min(Math.max(currentPage, 1), total);

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, String(value));
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  };

  // Cửa sổ tối đa 5 nút số trang, luôn cố canh giữa trang hiện tại, tự dồn
  // về 2 đầu khi trang hiện tại gần đầu/cuối danh sách.
  let start = Math.max(1, current - Math.floor(MAX_PAGE_BUTTONS / 2));
  const end = Math.min(total, start + MAX_PAGE_BUTTONS - 1);
  start = Math.max(1, end - MAX_PAGE_BUTTONS + 1);

  const pages: number[] = [];
  for (let page = start; page <= end; page++) pages.push(page);

  const isFirst = current <= 1;
  const isLast = current >= total;

  const navButtonClass = (disabled: boolean) =>
    `rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
      disabled
        ? "pointer-events-none border-slate-100 text-slate-300"
        : "hover:bg-slate-50"
    }`;

  const edgeButtonClass = (disabled: boolean) =>
    `flex items-center rounded-lg border p-1.5 ${
      disabled
        ? "pointer-events-none border-slate-100 text-slate-300"
        : "text-slate-500 hover:bg-slate-50"
    }`;

  const pageButtonClass = (page: number) =>
    `min-w-[1.75rem] rounded-lg border px-2 py-1.5 text-center text-xs font-medium ${
      page === current
        ? "border-blue-600 bg-blue-600 text-white"
        : "hover:bg-slate-50"
    }`;

  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm">
      <span className="text-slate-500">
        Trang <span className="font-bold text-slate-900">{current}</span> /{" "}
        {total}
      </span>

      <div className="flex items-center gap-1.5">
        <Link
          href={buildHref(1)}
          aria-label="Trang đầu"
          className={edgeButtonClass(isFirst)}
        >
          <ChevronsLeft size={14} />
        </Link>

        <Link href={buildHref(Math.max(current - 1, 1))} className={navButtonClass(isFirst)}>
          Trước
        </Link>

        {pages.map((page) => (
          <Link key={page} href={buildHref(page)} className={pageButtonClass(page)}>
            {page}
          </Link>
        ))}

        <Link href={buildHref(Math.min(current + 1, total))} className={navButtonClass(isLast)}>
          Sau
        </Link>

        <Link
          href={buildHref(total)}
          aria-label="Trang cuối"
          className={edgeButtonClass(isLast)}
        >
          <ChevronsRight size={14} />
        </Link>
      </div>
    </div>
  );
}
