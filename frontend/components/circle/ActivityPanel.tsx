"use client";

import {
  Activity, Banknote, CheckCircle2, Coins, Handshake, PlusCircle, Play, ScrollText, UserPlus, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { listActivity } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, timeAgo } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import type { PanelProps } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  CIRCLE_CREATED: PlusCircle,
  CIRCLE_STARTED: Play,
  RULES_UPDATED: ScrollText,
  MEMBER_INVITED: UserPlus,
  MEMBER_JOINED: Users,
  CONTRIBUTION_RECORDED: Coins,
  CONTRIBUTION_CONFIRMED: CheckCircle2,
  PAYOUT_RECORDED: Banknote,
  PAYOUT_CONFIRMED: Handshake,
};

export default function ActivityPanel({ circleId, version }: PanelProps) {
  const { data, error, loading } = useAsync(() => listActivity(circleId), [circleId, version]);
  const items = data ?? [];

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">Activity log</h2>
        <p className="text-sm text-muted">
          Append-only. Every action writes one row that can never be edited or deleted — this is the audit trail
          that replaces the paper book.
        </p>
      </div>

      {loading && !data && <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />}

      {data && items.length === 0 && (
        <EmptyState icon={Activity} title="Nothing has happened yet" message="Actions in this circle will appear here." />
      )}

      {items.length > 0 && (
        <ol className="relative space-y-4 border-l border-line pl-6">
          {items.map((a) => {
            const Icon = ICONS[a.type] ?? Activity;
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-[34px] grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-primary">
                  <Icon size={15} />
                </span>
                <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-body">{a.message}</span>
                    <span className="text-xs text-muted" title={formatDate(a.created_at)}>
                      {timeAgo(a.created_at) || formatDate(a.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {a.actor_name ? `by ${a.actor_name}` : "system"} · {a.type.toLowerCase().replace(/_/g, " ")}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
