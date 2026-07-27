"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Layers, Mail, Users } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/circles", label: "Circles", icon: Layers },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/emails", label: "Emails", icon: Mail },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="-mx-1 overflow-x-auto">
      <nav className="flex min-w-max gap-1 border-b border-line px-1">
        {LINKS.map((l) => {
          // "/admin" would otherwise light up on every sub-route.
          const on = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                on
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:border-line hover:text-body"
              }`}
            >
              <l.icon size={16} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
