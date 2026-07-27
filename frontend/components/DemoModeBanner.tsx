"use client";

import { TriangleAlert } from "lucide-react";
import { API_MODE, MOCK_LOGIN } from "@/lib/api";

/**
 * Demo mode keeps its accounts in memory, so the only way in is a seeded login nobody
 * could guess. Printing it here is the point of the banner — and it stays loud about the
 * data being thrown away, which is the part that surprises people.
 */
export default function DemoModeBanner({ className = "" }: { className?: string }) {
  if (API_MODE !== "mock") return null;

  return (
    <div className={`rounded-2xl border-2 border-accent/60 bg-accent/10 p-4 ${className}`}>
      <div className="flex gap-3">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-accent-dark" />
        <div className="text-sm text-body">
          <p className="font-heading font-bold text-accent-dark">Demo mode — no backend connected</p>
          <p className="mt-1.5">
            Sign in as <b>{MOCK_LOGIN.email}</b> with the password <b>{MOCK_LOGIN.password}</b>, or
            sign up for your own account. Passwords really are checked, but only against a list held
            in this browser — a reload resets it, along with every circle you create. That seeded
            account is also the one platform admin; anything you sign up is a plain user.
          </p>
          <p className="mt-2">
            For accounts that outlive the tab, create <code>frontend/.env.local</code> with{" "}
            <code>NEXT_PUBLIC_LOCAL_API=true</code>, <code>DATABASE_URL</code> and{" "}
            <code>JWT_SECRET_KEY</code>, then restart the server. Full steps are in{" "}
            <code>SELF_HOSTING.md</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Compact variant for dense headers where the full banner will not fit. */
export function DemoModePill({ className = "" }: { className?: string }) {
  if (API_MODE !== "mock") return null;

  return (
    <span
      title="Demo mode: in-memory data, reset on every reload"
      className={`inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-dark ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Demo
    </span>
  );
}
