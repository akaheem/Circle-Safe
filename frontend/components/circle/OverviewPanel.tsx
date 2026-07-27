"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Clock, Coins, Trophy, UserCheck, Wallet } from "lucide-react";
import { getDashboard, listContributions, recordContribution } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import ProgressBar from "@/components/ui/ProgressBar";
import Alert from "@/components/ui/Alert";
import type { CyclePoint } from "@/components/charts/CycleChart";
import type { PanelProps } from "@/lib/types";

const CycleChart = dynamic(() => import("@/components/charts/CycleChart"), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-surface" />,
});

export default function OverviewPanel({ circleId, circle, me, version, onChanged }: PanelProps) {
  const { user } = useSession();
  const dashQ = useAsync(() => getDashboard(circleId), [circleId, version]);
  const contribQ = useAsync(() => listContributions(circleId), [circleId, version]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dash = dashQ.data;
  const contributions = contribQ.data ?? [];

  const byCycle = new Map<number, CyclePoint>();
  contributions.forEach((c) => {
    const point = byCycle.get(c.cycle) ?? { cycle: c.cycle, confirmed: 0, pending: 0 };
    if (c.status === "CONFIRMED") point.confirmed += Number(c.amount);
    else point.pending += Number(c.amount);
    byCycle.set(c.cycle, point);
  });
  const chartData = [...byCycle.values()].sort((a, b) => a.cycle - b.cycle);

  const myContribution = contributions.find(
    (c) => c.user_id === user?.id && c.cycle === circle.current_cycle,
  );
  const canContribute =
    circle.status === "ACTIVE" && me?.status === "ACTIVE" && !myContribution;

  async function onRecord() {
    setSaving(true);
    setError(null);
    try {
      await recordContribution(circleId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your contribution");
    } finally {
      setSaving(false);
    }
  }

  if (dashQ.error) return <Alert tone="error">{dashQ.error}</Alert>;

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pot this cycle" icon={Wallet}
          value={dash ? formatMoney(Number(dash.pot), dash.currency) : "—"}
          hint={`Target ${formatMoney(circle.contribution_amount * circle.max_members, circle.currency)}`}
        />
        <StatCard
          label="Paid this cycle" icon={UserCheck} tone="accent"
          value={dash ? `${Number(dash.members_paid)} / ${Number(dash.total_members)}` : "—"}
          hint="Confirmed contributions"
        />
        <StatCard
          label="Next recipient" icon={Trophy}
          value={dash?.next_recipient ?? "—"}
          hint={circle.status === "ACTIVE" ? `Cycle ${circle.current_cycle}` : "Set the payout order"}
        />
        <StatCard
          label="Circle progress" icon={Coins} tone="neutral"
          value={`${dash ? Math.round(Number(dash.completion_pct)) : 0}%`}
          hint={`${Math.max(circle.current_cycle - 1, 0)} of ${circle.max_members} payouts done`}
        />
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">This cycle</h2>
            <p className="text-sm text-muted">
              {dash
                ? `${Number(dash.members_paid)} of ${Number(dash.total_members)} members have a confirmed contribution.`
                : "Loading…"}
            </p>
          </div>
          {canContribute && (
            <button onClick={onRecord} disabled={saving} className="btn-primary btn-sm disabled:opacity-60">
              <Coins size={16} /> {saving ? "Recording…" : "Record my contribution"}
            </button>
          )}
          {myContribution && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                myContribution.status === "CONFIRMED"
                  ? "bg-primary/12 text-primary"
                  : "bg-accent/15 text-accent-dark"
              }`}
            >
              {myContribution.status === "CONFIRMED" ? <CheckCircle2 size={14} /> : <Clock size={14} />}
              {myContribution.status === "CONFIRMED"
                ? "Your contribution is confirmed"
                : "Your contribution awaits confirmation"}
            </span>
          )}
        </div>

        <ProgressBar
          value={dash && Number(dash.total_members) ? (Number(dash.members_paid) / Number(dash.total_members)) * 100 : 0}
          label="Contributions collected"
          caption={dash ? formatMoney(Number(dash.pot), dash.currency) : ""}
        />
      </div>

      <div className="card">
        <h2 className="font-heading text-lg font-semibold">Contributions by cycle</h2>
        <p className="mb-4 text-sm text-muted">Green is confirmed, gold is awaiting confirmation.</p>
        {chartData.length === 0 ? (
          <div className="grid h-[220px] place-items-center text-sm text-muted">
            No contributions recorded yet.
          </div>
        ) : (
          <CycleChart data={chartData} currency={circle.currency} />
        )}
      </div>
    </div>
  );
}
