"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Search, ShieldCheck, Users } from "lucide-react";
import { adminListUsers } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AdminGuard, { Pill } from "@/components/admin/AdminGuard";

export default function AdminUsersPage() {
  return (
    <AdminGuard
      title="All users"
      subtitle="Who has signed up, their accounts, and how many circles they are in."
    >
      <UsersTable />
    </AdminGuard>
  );
}

function UsersTable() {
  const { data, error } = useAsync(() => adminListUsers(), []);
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data ?? []).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [data, term]);

  const unverified = (data ?? []).filter((u) => !u.phone_verified_at).length;

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter by name or email"
            aria-label="Filter users"
            className="input pl-11"
          />
        </div>
        {data && (
          <span className="text-sm text-muted">
            {rows.length === data.length
              ? `${data.length} user${data.length === 1 ? "" : "s"}`
              : `${rows.length} of ${data.length} users`}
            {unverified > 0 && ` · ${unverified} unverified`}
          </span>
        )}
      </div>

      {!data && <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />}

      {data && rows.length === 0 && (
        <EmptyState
          icon={Users}
          title={term ? `No users match “${term.trim()}”` : "No users yet"}
          message={
            term
              ? "Try part of the name or the address they signed up with."
              : "Everyone who signs up appears here."
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
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">WhatsApp verified</th>
                <th className="px-5 py-3 text-right font-semibold">Circles</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-surface/40">
                  <td className="px-5 py-3.5 font-medium text-body">{u.name}</td>
                  <td className="px-5 py-3.5 text-muted">{u.email}</td>
                  <td className="px-5 py-3.5">
                    {u.role === "ADMIN" ? (
                      <Pill tone="primary">
                        <ShieldCheck size={12} /> ADMIN
                      </Pill>
                    ) : (
                      <Badge value="USER" />
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {u.phone_verified_at ? (
                      <span
                        title={formatDate(u.phone_verified_at)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                      >
                        <BadgeCheck size={16} /> Verified
                      </span>
                    ) : (
                      <Pill tone="accent">unverified</Pill>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-muted">{u.circles_count}</td>
                  <td className="px-5 py-3.5 text-muted">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Admin rights come from the ADMIN_EMAILS setting, applied when the address signs up.
        The phone number shown is optional and was previously used for WhatsApp verification.
      </p>
    </div>
  );
}
