"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity, ArrowLeft, Banknote, LayoutDashboard, Play, Receipt,
  ShieldCheck, SlidersHorizontal, Users,
} from "lucide-react";
import { getCircle, listMembers, startCircle, USE_MOCK } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useLive } from "@/lib/useLive";
import { useSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import OverviewPanel from "@/components/circle/OverviewPanel";
import MembersPanel from "@/components/circle/MembersPanel";
import RulesBuilder from "@/components/circle/RulesBuilder";
import LedgerPanel from "@/components/circle/LedgerPanel";
import PayoutsPanel from "@/components/circle/PayoutsPanel";
import TrustPanel from "@/components/circle/TrustPanel";
import ActivityPanel from "@/components/circle/ActivityPanel";
import type { PanelProps } from "@/lib/types";

const TABS: (TabDef & { render: (p: PanelProps) => React.ReactNode })[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, render: (p) => <OverviewPanel {...p} /> },
  { key: "members", label: "Members", icon: Users, render: (p) => <MembersPanel {...p} /> },
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

  const isOwner = me?.role === "OWNER" || circle.owner_id === user?.id;
  const activeMembers = membersQ.data?.filter((m) => m.status === "ACTIVE").length ?? 0;
  const panelProps: PanelProps = { circleId, circle, me, version, onChanged: refresh };
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div>
      <BackLink />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold">{circle.name}</h1>
            <Badge value={circle.status} />
            <LiveDot status={liveStatus} />
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {formatMoney(circle.contribution_amount, circle.currency)} ·{" "}
            {circle.frequency === "WEEKLY" ? "weekly" : "monthly"} · {activeMembers}/{circle.max_members} members ·{" "}
            {circle.status === "PENDING"
              ? "not started yet"
              : `cycle ${circle.current_cycle} of ${circle.max_members}`}
          </p>
        </div>

        {isOwner && circle.status === "PENDING" && (
          <button onClick={onStart} disabled={starting} className="btn-primary btn-sm disabled:opacity-60">
            <Play size={16} /> {starting ? "Starting…" : "Start circle"}
          </button>
        )}
      </header>

      {actionError && <Alert tone="error" className="mb-5">{actionError}</Alert>}

      {USE_MOCK && (
        <Alert tone="info" className="mb-5">
          <b>Demo mode</b> — data lives in the browser. Set <code>NEXT_PUBLIC_API_URL</code> (and{" "}
          <code>NEXT_PUBLIC_WS_URL</code>) to run against the live Sub0 backend.
        </Alert>
      )}

      {circle.status === "PENDING" && (
        <Alert tone="info" className="mb-5">
          This circle hasn&apos;t started. Invite members and set the payout order first — rules and order lock once it&apos;s active.
        </Alert>
      )}

      <Tabs tabs={TABS} active={tab} onChange={selectTab} />
      <div className="pt-6">{activeTab.render(panelProps)}</div>
    </div>
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
