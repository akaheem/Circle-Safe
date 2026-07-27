"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity, ArrowLeft, Banknote, CalendarClock, Globe, Inbox, LayoutDashboard, Lock, Play, Receipt,
  ShieldCheck, SlidersHorizontal, Users,
} from "lucide-react";
import { getCircle, listJoinRequests, listMembers, me as fetchMe, startCircle, USE_MOCK } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useLive } from "@/lib/useLive";
import { useSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import Countdown from "@/components/Countdown";
import OverviewPanel from "@/components/circle/OverviewPanel";
import MembersPanel from "@/components/circle/MembersPanel";
import RequestsPanel from "@/components/circle/RequestsPanel";
import RulesBuilder from "@/components/circle/RulesBuilder";
import LedgerPanel from "@/components/circle/LedgerPanel";
import PayoutsPanel from "@/components/circle/PayoutsPanel";
import TrustPanel from "@/components/circle/TrustPanel";
import ActivityPanel from "@/components/circle/ActivityPanel";
import type { JoinRequest, PanelProps } from "@/lib/types";

type PanelTab = TabDef & {
  render: (p: PanelProps) => React.ReactNode;
  /** Owners, treasurers and platform admins only. */
  manageOnly?: boolean;
};

const TABS: PanelTab[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, render: (p) => <OverviewPanel {...p} /> },
  { key: "members", label: "Members", icon: Users, render: (p) => <MembersPanel {...p} /> },
  { key: "requests", label: "Requests", icon: Inbox, manageOnly: true, render: (p) => <RequestsPanel {...p} /> },
  { key: "rules", label: "Rules & Order", icon: SlidersHorizontal, render: (p) => <RulesBuilder {...p} /> },
  { key: "ledger", label: "Ledger", icon: Receipt, render: (p) => <LedgerPanel {...p} /> },
  { key: "payouts", label: "Payouts", icon: Banknote, render: (p) => <PayoutsPanel {...p} /> },
  { key: "trust", label: "Trust & Health", icon: ShieldCheck, render: (p) => <TrustPanel {...p} /> },
  { key: "activity", label: "Activity", icon: Activity, render: (p) => <ActivityPanel {...p} /> },
];

export default function CirclePage() {
  const params = useParams<{ id: string }>();
  const circleId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();

  const [version, setVersion] = useState(0);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const liveStatus = useLive(refresh);

  const circleQ = useAsync(() => getCircle(circleId), [circleId, version]);
  const membersQ = useAsync(() => listMembers(circleId), [circleId, version]);

  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(requestedTab && TABS.some((t) => t.key === requestedTab) ? requestedTab : "overview");
  useEffect(() => {
    if (requestedTab && TABS.some((t) => t.key === requestedTab)) setTab(requestedTab);
  }, [requestedTab]);

  function selectTab(key: string) {
    setTab(key);
    router.replace(`/circles/${circleId}?tab=${key}`, { scroll: false });
  }

  const circle = circleQ.data;
  const me = useMemo(
    () => membersQ.data?.find((m) => m.user_id === user?.id) ?? null,
    [membersQ.data, user?.id],
  );

  // An admin reads any circle, so the management tabs cannot key off membership alone.
  const accountQ = useAsync(() => fetchMe(), []);
  const isAdmin = (accountQ.data?.role ?? user?.role) === "ADMIN";
  const isOwner = me?.role === "OWNER" || (!!circle?.owner_id && circle.owner_id === user?.id);
  const canManage = isOwner || me?.role === "TREASURER" || isAdmin;

  const requestsQ = useAsync(
    () => (canManage ? listJoinRequests(circleId) : Promise.resolve([] as JoinRequest[])),
    [circleId, version, canManage],
  );
  const pendingRequests = requestsQ.data?.filter((r) => r.status === "PENDING").length ?? 0;

  async function onStart() {
    setStarting(true);
    setActionError(null);
    try {
      await startCircle(circleId);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not start the circle");
    } finally {
      setStarting(false);
    }
  }

  if (circleQ.error) {
    return (
      <div>
        <BackLink />
        <Alert tone="error">{circleQ.error}</Alert>
      </div>
    );
  }

  if (!circle) {
    return (
      <div>
        <BackLink />
        <div className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    );
  }

  const activeMembers = membersQ.data?.filter((m) => m.status === "ACTIVE").length ?? 0;
  const panelProps: PanelProps = { circleId, circle, me, version, onChanged: refresh };

  const tabs = TABS.filter((t) => !t.manageOnly || canManage).map((t) =>
    t.key === "requests" && pendingRequests ? { ...t, label: `Requests (${pendingRequests})` } : t,
  );
  const activeTab = tabs.find((t) => t.key === tab) ?? tabs[0];
  const scheduled = circle.status === "PENDING" && !!circle.starts_at;

  return (
    <div>
      <BackLink />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold">{circle.name}</h1>
            <Badge value={circle.status} />
            <VisibilityPill value={circle.visibility ?? "PUBLIC"} />
            <LiveDot status={liveStatus} />
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {formatMoney(circle.contribution_amount, circle.currency)} ·{" "}
            {circle.frequency === "WEEKLY" ? "weekly" : "monthly"} · {activeMembers}/{circle.max_members} members ·{" "}
            {circle.status === "PENDING"
              ? "not started yet"
              : `cycle ${circle.current_cycle} of ${circle.max_members}`}
          </p>
          {scheduled && (
            <p className="mt-2.5 inline-flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-dark">
                <CalendarClock size={13} />
                <Countdown at={circle.starts_at} />
              </span>
              Scheduled for {formatDateTime(circle.starts_at)}
            </p>
          )}
        </div>

        {isOwner && circle.status === "PENDING" && (
          <button onClick={onStart} disabled={starting} className="btn-primary btn-sm disabled:opacity-60">
            <Play size={16} /> {starting ? "Starting…" : scheduled ? "Start now" : "Start circle"}
          </button>
        )}
      </header>

      {actionError && <Alert tone="error" className="mb-5">{actionError}</Alert>}

      {USE_MOCK && (
        <Alert tone="info" className="mb-5">
          <b>Demo mode</b> — data lives in the browser. Set <code>NEXT_PUBLIC_LOCAL_API=true</code> for the
          self-hosted Postgres runtime, or <code>NEXT_PUBLIC_API_URL</code> +{" "}
          <code>NEXT_PUBLIC_WS_URL</code> for a live Sub0 instance.
        </Alert>
      )}

      {circle.status === "PENDING" && (
        <Alert tone="info" className="mb-5">
          {scheduled ? (
            <>
              This circle starts on its own at {formatDateTime(circle.starts_at)}, as long as two or more
              members have joined by then. Until it does, keep inviting people and approving requests —
              rules and payout order lock the moment it goes active.
            </>
          ) : (
            <>
              This circle hasn&apos;t started. Invite members and set the payout order first — rules and
              order lock once it&apos;s active.
            </>
          )}
        </Alert>
      )}

      <Tabs tabs={tabs} active={activeTab.key} onChange={selectTab} />
      <div className="pt-6">{activeTab.render(panelProps)}</div>
    </div>
  );
}

/** A scheduled start needs the time of day, which formatDate() drops. */
function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function VisibilityPill({ value }: { value: "PUBLIC" | "PRIVATE" }) {
  const isPublic = value === "PUBLIC";
  const Icon = isPublic ? Globe : Lock;
  return (
    <span
      title={isPublic ? "Listed in discovery — people can request to join" : "Invite only, hidden from discovery"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isPublic ? "bg-primary/12 text-primary" : "bg-muted/15 text-muted"
      }`}
    >
      <Icon size={12} />
      {value}
    </span>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
      <ArrowLeft size={16} /> Back to my circles
    </Link>
  );
}

function LiveDot({ status }: { status: ReturnType<typeof useLive> }) {
  const map = {
    live: { text: "Live", cls: "bg-primary/12 text-primary", dot: "bg-primary animate-pulse" },
    connecting: { text: "Connecting", cls: "bg-muted/12 text-muted", dot: "bg-muted" },
    offline: { text: "Reconnecting", cls: "bg-accent/15 text-accent-dark", dot: "bg-accent" },
    demo: { text: "Demo data", cls: "bg-muted/12 text-muted", dot: "bg-muted" },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${map.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  );
}
