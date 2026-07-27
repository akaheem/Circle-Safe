"use client";

import { useState } from "react";
import { Banknote, Check, CircleDot, Handshake, Lock } from "lucide-react";
import { confirmPayoutReceived, listMembers, listPayouts, recordPayout } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import type { PanelProps, Payout } from "@/lib/types";

export default function PayoutsPanel({ circleId, circle, me, version, onChanged }: PanelProps) {
  const { user } = useSession();
  const payoutsQ = useAsync(() => listPayouts(circleId), [circleId, version]);
  const membersQ = useAsync(() => listMembers(circleId), [circleId, version]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payouts = payoutsQ.data ?? [];
  const members = membersQ.data ?? [];
  const isOwner = me?.role === "OWNER";

  const byCycle = new Map<number, Payout>();
  payouts.forEach((p) => byCycle.set(Number(p.cycle), p));

  // The schedule is the payout order: cycle N pays the member at position N.
  const schedule = Array.from({ length: circle.max_members }, (_, i) => {
    const cycle = i + 1;
    return {
      cycle,
      member: members.find((m) => Number(m.payout_position) === cycle) ?? null,
      payout: byCycle.get(cycle) ?? null,
    };
  });

  const canRecord = isOwner && circle.status === "ACTIVE" && !byCycle.has(circle.current_cycle);

  async function onRecord() {
    setBusy("record");
    setError(null);
    try {
      await recordPayout(circleId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the payout");
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmReceived(payoutId: string) {
    setBusy(payoutId);
    setError(null);
    try {
      await confirmPayoutReceived(payoutId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm receipt");
    } finally {
      setBusy(null);
    }
  }

  if (payoutsQ.error) return <Alert tone="error">{payoutsQ.error}</Alert>;

  const paidOut = payouts.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Payout schedule</h2>
          <p className="text-sm text-muted">
            {formatMoney(paidOut, circle.currency)} paid out across {payouts.length}{" "}
            {payouts.length === 1 ? "cycle" : "cycles"}.
          </p>
        </div>
        {canRecord && (
          <button onClick={onRecord} disabled={busy === "record"} className="btn-primary btn-sm disabled:opacity-60">
            <Banknote size={16} />
            {busy === "record" ? "Recording…" : `Record payout for cycle ${circle.current_cycle}`}
          </button>
        )}
      </div>

      {isOwner && circle.status === "ACTIVE" && byCycle.has(circle.current_cycle) && (
        <Alert tone="success">Cycle {circle.current_cycle} has already been paid out.</Alert>
      )}

      <ol className="space-y-3">
        {schedule.map(({ cycle, member, payout }) => {
          const isCurrent = cycle === circle.current_cycle && circle.status === "ACTIVE";
          const done = !!payout;
          const mine = payout?.recipient_id === user?.id;

          return (
            <li
              key={cycle}
              className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 shadow-card ${
                isCurrent ? "border-primary ring-1 ring-primary/20" : "border-line"
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-heading text-sm font-bold ${
                  done ? "bg-primary text-white" : isCurrent ? "bg-primary/15 text-primary" : "bg-surface text-muted"
                }`}
              >
                {done ? <Check size={18} /> : cycle}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-body">
                    {payout?.recipient_name ?? member?.name ?? "Position unassigned"}
                  </span>
                  {payout && <Badge value={payout.status} />}
                  {isCurrent && !done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
                      <CircleDot size={12} /> Current cycle
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-muted">
                  Cycle {cycle}
                  {payout
                    ? ` · ${formatMoney(Number(payout.amount), circle.currency)} · ${formatDate(payout.created_at)}`
                    : member
                      ? " · scheduled"
                      : " · assign a member in Rules & Order"}
                </div>
              </div>

              {payout?.status === "PAID" && mine && (
                <button
                  onClick={() => onConfirmReceived(payout.id)} disabled={busy === payout.id}
                  className="btn-primary btn-sm disabled:opacity-60"
                >
                  <Handshake size={16} /> {busy === payout.id ? "Confirming…" : "I received this"}
                </button>
              )}
              {payout?.status === "PAID" && !mine && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Lock size={13} /> Awaiting recipient confirmation
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
