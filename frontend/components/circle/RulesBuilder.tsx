"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Coins, GripVertical, Lock, RotateCcw, Save, Shuffle } from "lucide-react";
import { listMembers, setPayoutOrder, updateCircleRules } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import type { Circle, Member, PanelProps } from "@/lib/types";

interface Rules {
  frequency: Circle["frequency"];
  contribution_amount: number;
  grace_period_days: number;
  late_fee: number;
}

const rulesOf = (c: Circle): Rules => ({
  frequency: c.frequency,
  contribution_amount: Number(c.contribution_amount) || 0,
  grace_period_days: Number(c.rules?.grace_period_days ?? 0),
  late_fee: Number(c.rules?.late_fee ?? 0),
});

export default function RulesBuilder({ circleId, circle, me, version, onChanged }: PanelProps) {
  const membersQ = useAsync(() => listMembers(circleId), [circleId, version]);

  const [order, setOrder] = useState<Member[]>([]);
  const [rules, setRules] = useState<Rules>(() => rulesOf(circle));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const editable = me?.role === "OWNER" && circle.status === "PENDING";

  useEffect(() => {
    if (membersQ.data) setOrder(membersQ.data);
  }, [membersQ.data]);

  useEffect(() => {
    setRules(rulesOf(circle));
  }, [circle]);

  const baseline = membersQ.data ?? [];
  const orderDirty = useMemo(
    () => order.some((m, i) => Number(m.payout_position) !== i + 1),
    [order],
  );
  const rulesDirty = useMemo(() => {
    const b = rulesOf(circle);
    return (
      b.frequency !== rules.frequency ||
      b.contribution_amount !== rules.contribution_amount ||
      b.grace_period_days !== rules.grace_period_days ||
      b.late_fee !== rules.late_fee
    );
  }, [circle, rules]);
  const dirty = orderDirty || rulesDirty;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSaved(false);
    setOrder((items) => {
      const from = items.findIndex((m) => m.id === active.id);
      const to = items.findIndex((m) => m.id === over.id);
      return from === -1 || to === -1 ? items : arrayMove(items, from, to);
    });
  }

  function shuffle() {
    setSaved(false);
    // Fisher–Yates: a fair random draw, the way a physical Ajo ballot works.
    setOrder((items) => {
      const next = [...items];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  function reset() {
    setOrder(baseline);
    setRules(rulesOf(circle));
    setSaved(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (rulesDirty) {
        await updateCircleRules({
          circle_id: circleId,
          frequency: rules.frequency,
          contribution_amount: rules.contribution_amount,
          rules: { grace_period_days: rules.grace_period_days, late_fee: rules.late_fee },
        });
      }
      // set-payout-order takes one member per call, so save only the rows that moved.
      const moved = order
        .map((m, i) => ({ m, position: i + 1 }))
        .filter(({ m, position }) => Number(m.payout_position) !== position);
      for (const { m, position } of moved) {
        await setPayoutOrder({ circle_id: circleId, user_id: m.user_id, payout_position: position });
      }
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rules");
    } finally {
      setSaving(false);
    }
  }

  if (membersQ.error) return <Alert tone="error">{membersQ.error}</Alert>;

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      {saved && !dirty && <Alert tone="success">Rules and payout order saved.</Alert>}
      {!editable && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-2">
            <Lock size={14} />
            {me?.role === "OWNER"
              ? "Rules are locked because the circle is already running — this is what stops mid-cycle rule changes."
              : "Only the circle owner can change the rules and payout order."}
          </span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Payout order */}
        <section className="card">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">Payout order</h2>
            {editable && (
              <button onClick={shuffle} className="btn-outline btn-sm">
                <Shuffle size={15} /> Random draw
              </button>
            )}
          </div>
          <p className="mb-4 text-sm text-muted">
            {editable
              ? "Drag members to set who gets the pot in each cycle. Position 1 is paid first."
              : "Cycle by cycle, this is who receives the pot."}
          </p>

          {order.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Invite members first — they&apos;ll show up here to order.
            </p>
          ) : editable ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {order.map((m, i) => (
                    <SortableMemberRow key={m.id} member={m} position={i + 1} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul className="space-y-2">
              {order.map((m, i) => (
                <li key={m.id}>
                  <MemberRowBody member={m} position={i + 1} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Rule cards */}
        <section className="space-y-4">
          <RuleCard
            icon={Coins}
            title="Contribution"
            description="What each member pays into the pot every cycle."
          >
            <input
              type="number" min={1} className="input" value={rules.contribution_amount} disabled={!editable}
              onChange={(e) => { setSaved(false); setRules({ ...rules, contribution_amount: Number(e.target.value) }); }}
            />
            <p className="mt-2 text-xs text-muted">
              Pot per cycle: <b>{formatMoney(rules.contribution_amount * circle.max_members, circle.currency)}</b>
            </p>
          </RuleCard>

          <RuleCard icon={CalendarClock} title="Rhythm" description="How often a cycle completes and pays out.">
            <div className="grid grid-cols-2 gap-2">
              {(["WEEKLY", "MONTHLY"] as const).map((f) => (
                <button
                  key={f} type="button" disabled={!editable}
                  onClick={() => { setSaved(false); setRules({ ...rules, frequency: f }); }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition-colors disabled:opacity-60 ${
                    rules.frequency === f ? "border-primary bg-primary/8 text-primary" : "border-line bg-white text-muted"
                  }`}
                >
                  {f.toLowerCase()}
                </button>
              ))}
            </div>
          </RuleCard>

          <RuleCard
            icon={CalendarClock}
            title="Grace period"
            description="Days after the due date a contribution still counts as on time."
          >
            <input
              type="range" min={0} max={14} value={rules.grace_period_days} disabled={!editable}
              onChange={(e) => { setSaved(false); setRules({ ...rules, grace_period_days: Number(e.target.value) }); }}
              className="w-full accent-[#0FA968] disabled:opacity-60"
            />
            <p className="mt-1 text-sm font-semibold">
              {rules.grace_period_days} {rules.grace_period_days === 1 ? "day" : "days"}
            </p>
          </RuleCard>

          <RuleCard icon={Coins} title="Late fee" description="Charged when a contribution misses the grace period.">
            <input
              type="number" min={0} className="input" value={rules.late_fee} disabled={!editable}
              onChange={(e) => { setSaved(false); setRules({ ...rules, late_fee: Number(e.target.value) }); }}
            />
            <p className="mt-2 text-xs text-muted">
              {rules.late_fee ? formatMoney(rules.late_fee, circle.currency) : "No late fee"}
            </p>
          </RuleCard>
        </section>
      </div>

      {editable && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-4 shadow-card backdrop-blur">
          <span className="text-sm text-muted">
            {dirty ? "You have unsaved changes." : "Everything is saved."}
          </span>
          <div className="flex gap-2">
            <button onClick={reset} disabled={!dirty || saving} className="btn-outline btn-sm disabled:opacity-40">
              <RotateCcw size={15} /> Reset
            </button>
            <button onClick={save} disabled={!dirty || saving} className="btn-primary btn-sm disabled:opacity-40">
              <Save size={15} /> {saving ? "Saving…" : "Save rules & order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableMemberRow({ member, position }: { member: Member; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10" : undefined}
      {...attributes}
      {...listeners}
    >
      <MemberRowBody member={member} position={position} draggable dragging={isDragging} />
    </li>
  );
}

function MemberRowBody({
  member, position, draggable = false, dragging = false,
}: {
  member: Member;
  position: number;
  draggable?: boolean;
  dragging?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition-shadow ${
        dragging ? "border-primary shadow-glow" : "border-line"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {draggable && <GripVertical size={16} className="shrink-0 text-muted" />}
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 font-heading text-sm font-bold text-primary">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-body">{member.name}</div>
        <div className="truncate text-xs text-muted">Cycle {position} recipient</div>
      </div>
      {member.status === "INVITED" ? <Badge value="INVITED" /> : <Badge value={member.role} />}
    </div>
  );
}

function RuleCard({
  icon: Icon, title, description, children,
}: {
  icon: typeof Coins;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon size={17} />
        </span>
        <div>
          <h3 className="font-heading font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
