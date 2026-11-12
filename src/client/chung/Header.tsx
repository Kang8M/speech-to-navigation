"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "eForm ngoại trú" },
  { href: "/ket-qua", label: "Kết quả thử nghiệm" },
];

export function Header({ provider }: { provider: string }) {
  const pathname = usePathname();
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-primary px-4 py-2.5 text-white print:hidden">
      <h1 className="text-lg font-semibold">Trợ lý điền bệnh án TMH</h1>
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
