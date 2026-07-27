"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, ChevronDown, ChevronsUpDown, ChevronUp, Globe, Layers, Lock, Search,
} from "lucide-react";
import { adminListCircles } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import Countdown from "@/components/Countdown";
import AdminGuard from "@/components/admin/AdminGuard";
import type { AdminCircleRow } from "@/lib/types";

type SortKey =
  | "name" | "owner_name" | "status" | "visibility" | "current_cycle" | "members_count"
  | "contribution_amount" | "total_saved" | "confirmed_contributions" | "payouts_count"
  | "created_at";

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "name", label: "Circle" },
  { key: "owner_name", label: "Owner" },
  { key: "status", label: "Status" },
  { key: "visibility", label: "Visibility" },
  { key: "current_cycle", label: "Cycle" },
  { key: "members_count", label: "Members", right: true },
  { key: "contribution_amount", label: "Contribution", right: true },
  { key: "total_saved", label: "Saved", right: true },
  { key: "confirmed_contributions", label: "Confirmed", right: true },
  { key: "payouts_count", label: "Payouts", right: true },
  { key: "created_at", label: "Created" },
];

/** Numeric columns read best largest-first on the first click. */
const NUMERIC_FIRST_DESC = new Set<SortKey>([
  "current_cycle", "members_count", "contribution_amount", "total_saved",
  "confirmed_contributions", "payouts_count", "created_at",
]);

function compare(a: AdminCircleRow, b: AdminCircleRow, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x ?? "").localeCompare(String(y ?? ""), undefined, { sensitivity: "base" });
}

/** Cycles finished, as a share of the full rotation. Matches the member-facing dashboard. */
const progressPct = (c: AdminCircleRow) =>
  Math.round((Math.max(c.current_cycle - 1, 0) / Math.max(c.max_members, 1)) * 100);

export default function AdminCirclesPage() {
  return (
    <AdminGuard
      title="All circles"
      subtitle="Every circle on the platform with its progress. Open any one to see the full ledger."
    >
      <Circles />
    </AdminGuard>
  );
}

function Circles() {
  const { data, error } = useAsync(() => adminListCircles(), []);
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created_at", dir: -1 });

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const filtered = (data ?? []).filter((c) =>
      !q || `${c.name} ${c.owner_name} ${c.owner_email}`.toLowerCase().includes(q),
    );
    return filtered.sort((a, b) => compare(a, b, sort.key) * sort.dir);
  }, [data, term, sort]);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : { key, dir: NUMERIC_FIRST_DESC.has(key) ? -1 : 1 },
    );
  }

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter by circle, owner name or email"
            aria-label="Filter circles"
            className="input pl-11"
          />
        </div>
        {data && (
          <span className="text-sm text-muted">
            {rows.length === data.length
              ? `${data.length} circle${data.length === 1 ? "" : "s"}`
              : `${rows.length} of ${data.length} circles`}
          </span>
        )}
      </div>

      {!data && <div className="h-80 animate-pulse rounded-2xl border border-line bg-white" />}

      {data && rows.length === 0 && (
        <EmptyState
          icon={Layers}
          title={term ? `No circles match “${term.trim()}”` : "No circles yet"}
          message={
            term
              ? "Try part of the circle name or the owner's email address."
              : "Once someone starts a circle it shows up here, with its cycle progress and ledger totals."
          }
          action={
            term ? (
              <button onClick={() => setTerm("")} className="btn-outline btn-sm">Clear filter</button>
            ) : undefined
          }
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wide text-muted">
                {COLUMNS.map((col) => {
                  const on = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                      className={`px-4 py-3 font-semibold ${col.right ? "text-right" : ""}`}
                    >
                      <button
                        onClick={() => toggle(col.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-body ${
                          on ? "text-body" : ""
                        }`}
                      >
                        {col.label}
                        {on ? (
                          sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        ) : (
                          <ChevronsUpDown size={13} className="opacity-40" />
                        )}
                      </button>
                    </th>
                  );
                })}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface/40">
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/circles/${c.id}`}
                      className="font-semibold text-body transition-colors hover:text-primary"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-body">{c.owner_name}</div>
                    <div className="text-xs text-muted">{c.owner_email}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge value={c.status} />
                    {c.status === "PENDING" && c.starts_at && (
                      <div className="mt-1 text-xs text-accent-dark">
                        <Countdown at={c.starts_at} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      {c.visibility === "PRIVATE" ? <Lock size={14} /> : <Globe size={14} />}
                      {c.visibility === "PRIVATE" ? "Private" : "Public"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="w-24">
                      <div className="mb-1 text-xs font-semibold text-body">
                        {c.current_cycle} / {c.max_members}
                      </div>
                      <ProgressBar value={progressPct(c)} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted">
                    {c.members_count}
                    <span className="text-xs"> / {c.max_members}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted">
                    {formatMoney(c.contribution_amount, c.currency)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold">
                    {formatMoney(c.total_saved, c.currency)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="text-body">{c.confirmed_contributions}</div>
                    {c.pending_contributions > 0 && (
                      <div className="text-xs font-semibold text-accent-dark">
                        {c.pending_contributions} pending
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted">{c.payouts_count}</td>
                  <td className="px-4 py-3.5 text-muted">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/circles/${c.id}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-primary hover:text-primary-dark"
                    >
                      Open <ArrowUpRight size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Admins can open any circle read-only — the same ledger, members and activity a leader sees.
        Recording contributions and payouts stays with the circle&apos;s own members.
      </p>
    </div>
  );
}
