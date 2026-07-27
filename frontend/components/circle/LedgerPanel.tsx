"use client";

import { useState } from "react";
import { CheckCircle2, Coins, Receipt } from "lucide-react";
import { confirmContribution, listContributions, recordContribution } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import type { PanelProps } from "@/lib/types";

type Filter = "ALL" | "PENDING" | "CONFIRMED";

export default function LedgerPanel({ circleId, circle, me, version, onChanged }: PanelProps) {
  const { user } = useSession();
  const { data, error, loading } = useAsync(() => listContributions(circleId), [circleId, version]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canConfirm = me?.role === "OWNER" || me?.role === "TREASURER";
  const contributions = data ?? [];
  const rows = contributions.filter((c) => filter === "ALL" || c.status === filter);
  const totals = {
    confirmed: contributions.filter((c) => c.status === "CONFIRMED").reduce((s, c) => s + Number(c.amount), 0),
    pending: contributions.filter((c) => c.status === "PENDING").length,
  };

  const alreadyRecorded = contributions.some(
    (c) => c.user_id === user?.id && c.cycle === circle.current_cycle,
  );
  const canContribute = circle.status === "ACTIVE" && me?.status === "ACTIVE" && !alreadyRecorded;

  async function onConfirm(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await confirmContribution(id);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not confirm the contribution");
    } finally {
      setBusyId(null);
    }
  }

  async function onRecord() {
    setSaving(true);
    setActionError(null);
    try {
      await recordContribution(circleId);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record your contribution");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["ALL", "PENDING", "CONFIRMED"] as Filter[]).map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f ? "bg-primary text-white" : "bg-white text-muted ring-1 ring-line hover:text-body"
              }`}
            >
              {f === "ALL" ? "All" : f === "PENDING" ? `Pending${totals.pending ? ` (${totals.pending})` : ""}` : "Confirmed"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">
            Confirmed total <b className="text-body">{formatMoney(totals.confirmed, circle.currency)}</b>
          </span>
          {canContribute && (
            <button onClick={onRecord} disabled={saving} className="btn-primary btn-sm disabled:opacity-60">
              <Coins size={16} /> {saving ? "Recording…" : "Record my contribution"}
            </button>
          )}
        </div>
      </div>

      {loading && !data && <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />}

      {data && rows.length === 0 && (
        <EmptyState
          icon={Receipt}
          title={filter === "ALL" ? "No contributions yet" : `No ${filter.toLowerCase()} contributions`}
          message={
            circle.status === "PENDING"
              ? "Contributions open once the circle is started."
              : "Members record a contribution each cycle; a treasurer or the owner confirms it."
          }
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="px-5 py-3 font-semibold">Cycle</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Recorded</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                {canConfirm && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface/40">
                  <td className="px-5 py-3.5 font-medium text-body">
                    {c.name}
                    {c.user_id === user?.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{c.cycle}</td>
                  <td className="px-5 py-3.5 font-semibold">{formatMoney(Number(c.amount), circle.currency)}</td>
                  <td className="px-5 py-3.5 text-muted">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3.5"><Badge value={c.status} /></td>
                  {canConfirm && (
                    <td className="px-5 py-3.5 text-right">
                      {c.status === "PENDING" && (
                        <button
                          onClick={() => onConfirm(c.id)} disabled={busyId === c.id}
                          className="btn-outline btn-sm disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} /> {busyId === c.id ? "Confirming…" : "Confirm"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Every row here is backed by an append-only <code>_activity</code> entry — records can be added, never rewritten.
      </p>
    </div>
  );
}
