"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Inbox, LayoutDashboard, LogOut, PlusCircle, Shield } from "lucide-react";
import { useSession, clearSession, getToken } from "@/lib/auth";
import { logout, me } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // The session copy of the role can be stale, so the admin link waits on a fresh read.
  const account = useAsync(() => (ready && user ? me() : Promise.resolve(null)), [ready, user?.id]);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  async function onLogout() {
    const token = getToken();
    try {
      if (token) await logout(token);
    } catch {
      /* ignore */
    }
    clearSession();
    router.replace("/login");
  }

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>;
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/circles/new", label: "New Circle", icon: PlusCircle },
    { href: "/circles/discover", label: "Discover", icon: Compass },
    { href: "/requests", label: "Requests", icon: Inbox },
    ...(account.data?.role === "ADMIN"
      ? [{ href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-6 py-6 font-heading text-xl font-bold">
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent" />
          CircleSafe
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-body"
                }`}
              >
                <n.icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 font-heading text-sm font-bold text-primary">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-body">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
