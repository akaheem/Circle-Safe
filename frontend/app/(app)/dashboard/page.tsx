"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PlusCircle, Users, Wallet } from "lucide-react";
import { listMyCircles, USE_MOCK } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import type { Circle } from "@/lib/types";

export default function DashboardPage() {
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyCircles()
      .then(setCircles)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load circles"));
  }, []);

  return (
    <div>
      {USE_MOCK && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-dark">
          <b>Demo mode</b> — showing sample data. Set <code>NEXT_PUBLIC_API_URL</code> to connect the live Sub0 backend.
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">My Circles</h1>
          <p className="mt-1 text-muted">Track contributions, payouts, and trust across your groups.</p>
        </div>
        <Link href="/circles/new" className="btn-primary">
          <PlusCircle size={18} /> New Circle
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!circles && !error && <SkeletonGrid />}

      {circles && circles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <h3 className="font-heading text-lg font-semibold">No circles yet</h3>
          <p className="mt-2 text-sm text-muted">Create your first savings circle to get started.</p>
          <Link href="/circles/new" className="btn-primary mt-6 inline-flex">
            <PlusCircle size={18} /> Create a Circle
          </Link>
        </div>
      )}

      {circles && circles.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => (
            <Link
              key={c.id}
              href={`/circles/${c.id}`}
              className="group rounded-2xl border border-line bg-white p-6 shadow-card transition-transform hover:-translate-y-1"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="font-heading text-lg font-semibold leading-snug">{c.name}</h3>
                <Badge value={c.status} />
              </div>

              <div className="space-y-2.5 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-primary" />
                  {formatMoney(c.contribution_amount, c.currency)}{" "}
                  <span className="lowercase">/ {c.frequency === "WEEKLY" ? "week" : "month"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  {c.max_members} members
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>Cycle {c.current_cycle} of {c.max_members}</span>
                  <span>{Math.round((c.current_cycle / Math.max(c.max_members, 1)) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all"
                    style={{ width: `${Math.min(100, (c.current_cycle / Math.max(c.max_members, 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-primary">
                Open circle
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl border border-line bg-white" />
      ))}
    </div>
  );
}
