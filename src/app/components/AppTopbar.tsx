"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export default function AppTopbar({
  showSearch = true,
  bell,
}: {
  showSearch?: boolean;
  // Nhận sẵn từ AppLayout (Server Component) qua children-slot — AppTopbar
  // là Client Component nên không thể tự import/gọi thẳng NotificationBell
  // (Server Component, có truy vấn DB) bên trong nó.
  bell: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Ô tìm kiếm dùng chung trên mọi trang — điều hướng sang trang Tài sản kèm
  // từ khoá thay vì tự implement tìm kiếm riêng, tận dụng luôn logic tìm
  // kiếm (Asset Tag/Serial/Model...) đã có sẵn ở đó.
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = query.trim();

    if (trimmed) {
      router.push(`/assets?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <header
      className={`sticky top-0 z-10 flex h-16 items-center gap-4 bg-[#f4f8fc]/90 px-6 backdrop-blur ${
        showSearch ? "justify-between" : "justify-end"
      }`}
    >
      {showSearch && (
        <form onSubmit={handleSearchSubmit} className="max-w-md flex-1">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm tài sản, serial, người dùng..."
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </form>
      )}

      {bell}
    </header>
  );
}
