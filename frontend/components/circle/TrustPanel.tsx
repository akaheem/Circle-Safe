"use client";

import dynamic from "next/dynamic";
import { Award, HeartPulse, PiggyBank, TrendingUp, Users } from "lucide-react";
import { getCircleHealth, getInsights, getTrustScore } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import ProgressBar from "@/components/ui/ProgressBar";
import Alert from "@/components/ui/Alert";
import type { PanelProps } from "@/lib/types";

const TrustChart = dynamic(() => import("@/components/charts/TrustChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-surface" />,
});

const band = (pct: number) =>
  pct >= 90 ? { label: "Excellent", cls: "text-primary" }
  : pct >= 70 ? { label: "Healthy", cls: "text-primary" }
  : pct >= 50 ? { label: "Needs attention", cls: "text-accent-dark" }
  : { label: "At risk", cls: "text-red-600" };

export default function TrustPanel({ circleId, circle, version }: PanelProps) {
  const scoresQ = useAsync(() => getTrustScore(circleId), [circleId, version]);
  const healthQ = useAsync(() => getCircleHealth(circleId), [circleId, version]);
  const insightsQ = useAsync(() => getInsights(circleId), [circleId, version]);

  const scores = scoresQ.data ?? [];
  const health = healthQ.data;
  const insights = insightsQ.data;
  const healthPct = Number(health?.health_pct ?? 0);
  const healthBand = band(healthPct);

  if (scoresQ.error) return <Alert tone="error">{scoresQ.error}</Alert>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Circle health" icon={HeartPulse}
          value={`${Math.round(healthPct)}%`} hint={healthBand.label}
        />
        <StatCard
          label="Total saved" icon={PiggyBank} tone="accent"
          value={insights ? formatMoney(Number(insights.total_savings), circle.currency) : "—"}
          hint={`${insights ? Number(insights.total_confirmed) : 0} confirmed contributions`}
        />
        <StatCard
          label="Most reliable" icon={Award}
          value={insights?.most_reliable_member ?? "—"}
          hint="Most confirmed contributions"
        />
        <StatCard
          label="Avg per cycle" icon={TrendingUp} tone="neutral"
          value={insights?.avg_confirmed_per_cycle != null ? String(insights.avg_confirmed_per_cycle) : "—"}
          hint="Contributions confirmed per cycle"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card">
          <h2 className="font-heading text-lg font-semibold">Member trust scores</h2>
          <p className="mb-4 text-sm text-muted">
            Reliability = confirmed contributions ÷ cycles elapsed. Computed live from the ledger, never stored.
          </p>

          {scores.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No members to score yet.</p>
          ) : (
            <>
              <TrustChart rows={scores} />
              <ul className="mt-4 divide-y divide-line">
                {scores.map((s) => (
                  <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-semibold text-body">{s.name}</div>
                      <div className="text-xs text-muted">
                        {Number(s.confirmed_count)} confirmed
                        {Number(s.pending_count) > 0 && ` · ${Number(s.pending_count)} pending`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading text-sm font-bold text-body">
                        {Math.round(Number(s.reliability_pct))}%
                      </div>
                      <div className="text-xs text-muted">
                        {formatMoney(Number(s.total_contributed), circle.currency)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="card">
            <h2 className="font-heading text-lg font-semibold">Circle health</h2>
            <p className="mb-4 text-sm text-muted">
              How much of what was owed across all cycles has actually been confirmed.
            </p>

            <div className="mb-1 flex items-end justify-between">
              <span className={`font-heading text-4xl font-bold ${healthBand.cls}`}>
                {Math.round(healthPct)}%
              </span>
              <span className={`text-sm font-semibold ${healthBand.cls}`}>{healthBand.label}</span>
            </div>
            <ProgressBar value={healthPct} tone={healthPct >= 70 ? "primary" : "accent"} />

            <dl className="mt-5 space-y-2.5 text-sm">
              <Row label="Active members" value={String(Number(health?.active_members ?? 0))} />
              <Row label="Confirmed contributions" value={String(Number(health?.confirmed_contributions ?? 0))} />
              <Row label="Pending confirmations" value={String(Number(health?.pending_contributions ?? 0))} />
              <Row label="Payouts received" value={String(Number(health?.payouts_received ?? 0))} />
            </dl>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-dark">
                <Users size={17} />
              </span>
              <h3 className="font-heading font-semibold">Next payout</h3>
            </div>
            <p className="text-sm text-muted">
              {insights?.next_payout_member
                ? <>Cycle {circle.current_cycle} pays <b className="text-body">{insights.next_payout_member}</b>.</>
                : "No recipient is assigned to the current cycle yet."}
            </p>
          </div>
        </section>
      </div>

      <p className="text-xs text-muted">
        Trust scores, health and insights are cached for 60 seconds on the Sub0 side, so heavy aggregations
        stay cheap while the dashboard itself stays live.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-body">{value}</dd>
    </div>
  );
}
