"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Màn hình làm việc" },
  { href: "/ket-qua", label: "Kết quả thử nghiệm" },
  { href: "/eform", label: "Mô phỏng eForm ngoại trú" },
];

export function Header({ provider }: { provider: string }) {
  const pathname = usePathname();
  // Trang eForm mô phỏng màn EMR nên không hiện thanh của prototype; nút "Quay lại" dẫn về trang chính
  if (pathname === "/eform") return null;
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-primary px-4 py-2.5 text-white">
      <h1 className="text-lg font-semibold">Trợ lý điền bệnh án TMH – Prototype</h1>
      <nav className="flex gap-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className={`rounded px-3 py-1 text-sm ${
              pathname === link.href ? "bg-white/20 font-medium" : "hover:bg-white/10"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <span className="ml-auto rounded bg-white/15 px-2 py-0.5 text-xs">
        Chế độ AI: <strong>{provider}</strong>
      </span>
    </header>
  );
}
