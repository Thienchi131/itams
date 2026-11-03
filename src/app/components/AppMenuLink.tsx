"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppMenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();

  const active =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-white text-blue-700 shadow-sm"
          : "text-blue-50 hover:bg-white/15 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}