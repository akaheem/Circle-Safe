"use client";

import Link from "next/link";
import { LayoutDashboard, ShieldAlert } from "lucide-react";
import { me } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import AdminNav from "@/components/admin/AdminNav";
import { DemoModePill } from "@/components/DemoModeBanner";

type PillTone = "primary" | "accent" | "danger" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  primary: "bg-primary/12 text-primary",
  accent: "bg-accent/15 text-accent-dark",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  neutral: "bg-muted/12 text-muted",
};

/** Badge only knows the circle vocabulary; the console also needs a failure and an emphasis tone. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

interface AdminGuardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/**
 * Gates the admin console on `me().role === 'ADMIN'` and renders the shared chrome.
 * Non-admins get a message rather than a redirect: a redirect that guesses wrong
 * traps the user in a loop, and this way they can see which account they are on.
 */
export default function AdminGuard({ title, subtitle, children }: AdminGuardProps) {
  const { data: user, error, loading } = useAsync(() => me(), []);

  if (loading && !user) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-xl border border-line bg-white" />
        <div className="h-12 animate-pulse rounded-xl border border-line bg-white" />
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <Alert tone="error">{error}</Alert>
        <Link href="/dashboard" className="btn-outline btn-sm">
          <LayoutDashboard size={16} /> Back to dashboard
        </Link>
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admins only"
        message={`This console reads every circle on the platform, so it is limited to platform admins.${
          user?.email ? ` You are signed in as ${user.email}.` : ""
        } To grant access, add the address to the ADMIN_EMAILS setting and sign up with it.`}
        action={
          <Link href="/dashboard" className="btn-primary btn-sm">
            <LayoutDashboard size={16} /> Back to dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold">{title}</h1>
          <DemoModePill />
        </div>
        <p className="mt-1 text-muted">{subtitle}</p>
      </div>

      <div className="mb-8">
        <AdminNav />
      </div>

      {children}
    </div>
  );
}
