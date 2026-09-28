"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CaseTabs({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const base = `/cases/${caseId}`;
  const tabs = [
    { href: base, label: "Case" },
    { href: `${base}/sources`, label: "Sources" },
    { href: `${base}/timeline`, label: "Timeline" },
    { href: `${base}/episodes`, label: "Episodes & check" },
  ];
  return (
    <nav className="mb-6 flex gap-1 border-b border-stone-200">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base || pathname === `${base}/victim` : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active ? "border-accent font-medium text-accent" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
