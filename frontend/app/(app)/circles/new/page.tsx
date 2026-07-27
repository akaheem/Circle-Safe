"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Coins, ScrollText, Users } from "lucide-react";
import { createCircle } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import Alert from "@/components/ui/Alert";

const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "XOF", "USD"];

const STEPS = [
  { title: "Basics", hint: "Name and size", icon: Users },
  { title: "Contribution", hint: "Amount and rhythm", icon: Coins },
  { title: "Rules", hint: "Grace period and late fee", icon: ScrollText },
  { title: "Review", hint: "Confirm and create", icon: Check },
];

export default function NewCirclePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);
  const [amount, setAmount] = useState(5000);
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [currency, setCurrency] = useState("NGN");
  const [graceDays, setGraceDays] = useState(3);
  const [lateFee, setLateFee] = useState(0);

  const potPerCycle = amount * maxMembers;

  function validateStep(): string | null {
    if (step === 0) {
      if (name.trim().length < 2) return "Give your circle a name of at least 2 characters.";
      if (maxMembers < 2 || maxMembers > 50) return "A circle needs between 2 and 50 members.";
    }
    if (step === 1 && amount <= 0) return "The contribution amount must be greater than zero.";
    if (step === 2) {
      if (graceDays < 0 || graceDays > 30) return "Grace period must be between 0 and 30 days.";
      if (lateFee < 0) return "Late fee cannot be negative.";
    }
    return null;
  }

  function next() {
    const problem = validateStep();
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const circle = await createCircle({
        name: name.trim(),
        contribution_amount: amount,
        frequency,
        max_members: maxMembers,
        currency,
        rules: { grace_period_days: graceDays, late_fee: lateFee },
      });
      router.push(`/circles/${circle.id}?tab=rules`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the circle");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft size={16} /> Back to my circles
      </Link>

      <h1 className="font-heading text-3xl font-bold">Create a circle</h1>
      <p className="mt-1 text-muted">Four short steps. You can invite members and set the payout order next.</p>

      {/* Stepper */}
      <ol className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li
              key={s.title}
              className={`rounded-xl border p-3 transition-colors ${
                active ? "border-primary bg-primary/8" : done ? "border-primary/30 bg-white" : "border-line bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                    done ? "bg-primary text-white" : active ? "bg-primary/15 text-primary" : "bg-surface text-muted"
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className={`truncate text-sm font-semibold ${active ? "text-primary" : "text-body"}`}>{s.title}</div>
                  <div className="truncate text-xs text-muted">{s.hint}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="card mt-6">
        {error && <Alert tone="error" className="mb-5">{error}</Alert>}

        {step === 0 && (
          <div className="space-y-5">
            <label className="block">
              <span className="field-label">Circle name</span>
              <input
                className="input" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lagos Traders Circle" autoFocus
              />
            </label>
            <label className="block">
              <span className="field-label">How many members? ({maxMembers})</span>
              <input
                type="range" min={2} max={20} value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full accent-[#0FA968]"
              />
              <span className="mt-1 block text-xs text-muted">
                The circle runs for {maxMembers} cycles — one payout per member.
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
              <label className="block">
                <span className="field-label">Contribution per member</span>
                <input
                  type="number" min={1} className="input" value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))} autoFocus
                />
              </label>
              <label className="block">
                <span className="field-label">Currency</span>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <div>
              <span className="field-label">How often?</span>
              <div className="grid grid-cols-2 gap-3">
                {(["WEEKLY", "MONTHLY"] as const).map((f) => (
                  <button
                    key={f} type="button" onClick={() => setFrequency(f)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      frequency === f ? "border-primary bg-primary/8" : "border-line bg-white hover:border-primary/40"
                    }`}
                  >
                    <div className="font-heading font-semibold capitalize">{f.toLowerCase()}</div>
                    <div className="text-xs text-muted">
                      {f === "WEEKLY" ? "A payout every week" : "A payout every month"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Alert tone="info">
              Each cycle pools <b>{formatMoney(potPerCycle, currency)}</b> for one member.
            </Alert>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <label className="block">
              <span className="field-label">Grace period ({graceDays} {graceDays === 1 ? "day" : "days"})</span>
              <input
                type="range" min={0} max={14} value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
                className="w-full accent-[#0FA968]"
              />
              <span className="mt-1 block text-xs text-muted">
                How long after the due date a contribution still counts as on time.
              </span>
            </label>
            <label className="block">
              <span className="field-label">Late fee</span>
              <input
                type="number" min={0} className="input" value={lateFee}
                onChange={(e) => setLateFee(Number(e.target.value))}
              />
              <span className="mt-1 block text-xs text-muted">
                Charged when a contribution lands after the grace period. Set 0 for none.
              </span>
            </label>
          </div>
        )}

        {step === 3 && (
          <dl className="divide-y divide-line">
            <Row label="Circle name" value={name} />
            <Row label="Members" value={`${maxMembers} (${maxMembers} cycles)`} />
            <Row label="Contribution" value={`${formatMoney(amount, currency)} / ${frequency === "WEEKLY" ? "week" : "month"}`} />
            <Row label="Pot per cycle" value={formatMoney(potPerCycle, currency)} />
            <Row label="Grace period" value={`${graceDays} ${graceDays === 1 ? "day" : "days"}`} />
            <Row label="Late fee" value={lateFee ? formatMoney(lateFee, currency) : "None"} />
            <Row label="Starts as" value="PENDING — invite members, set the payout order, then start" />
          </dl>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button onClick={back} disabled={step === 0} className="btn-outline btn-sm disabled:opacity-40">
            <ArrowLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={next} className="btn-primary btn-sm">
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={submit} disabled={saving} className="btn-primary btn-sm disabled:opacity-60">
              {saving ? "Creating…" : "Create circle"} <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-body">{value || "—"}</dd>
    </div>
  );
}
