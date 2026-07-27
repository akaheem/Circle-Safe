"use client";

import { useState } from "react";
import { Check, Copy, LogIn, Mail, UserPlus, Users } from "lucide-react";
import { inviteMember, joinCircle, listMembers } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/lib/auth";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import type { PanelProps } from "@/lib/types";

export default function MembersPanel({ circleId, circle, me, version, onChanged }: PanelProps) {
  const { user } = useSession();
  const { data, error, loading } = useAsync(() => listMembers(circleId), [circleId, version]);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; invite_url?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const members = data ?? [];
  // Present whenever the mail did not actually go out — SMTP unconfigured, delivery failed, or
  // demo mode, where no request leaves the browser at all. The owner passes the link on by hand.
  // Absent means it really was delivered, so the "emailed" message below is only shown when true.
  const inviteUrl = sent?.invite_url;
  const isOwner = me?.role === "OWNER";
  const canInvite = isOwner && circle.status === "PENDING" && members.length < circle.max_members;
  const iAmInvited = me?.status === "INVITED";

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    setBusy(true);
    setActionError(null);
    setSent(null);
    setCopied(false);
    try {
      const invitation = await inviteMember({ circle_id: circleId, email: address });
      setSent({ email: address, invite_url: invitation.invite_url });
      setEmail("");
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not send the invite");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setActionError("Copying failed — select the link and copy it by hand.");
    }
  }

  async function onJoin() {
    setBusy(true);
    setActionError(null);
    try {
      await joinCircle(circleId);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not join the circle");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {sent && (
        <Alert tone="success">
          {inviteUrl ? (
            <>
              <p className="font-semibold">Invitation created for {sent.email}.</p>
              <p className="mt-1">
                No mail provider is configured, so send this link to your friend yourself.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-primary/20">
                  {inviteUrl}
                </code>
                <button onClick={() => onCopy(inviteUrl)} className="btn-outline btn-sm">
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Invitation emailed to {sent.email}.</p>
              <p className="mt-1">
                They have 14 days to accept. You can track or cancel it under Requests.
              </p>
            </>
          )}
        </Alert>
      )}

      {iAmInvited && (
        <div className="card flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-heading font-semibold">You&apos;ve been invited to this circle</h3>
            <p className="text-sm text-muted">Accept to take a payout position and start contributing.</p>
          </div>
          <button onClick={onJoin} disabled={busy} className="btn-primary btn-sm disabled:opacity-60">
            <LogIn size={16} /> {busy ? "Joining…" : "Accept invite"}
          </button>
        </div>
      )}

      {canInvite && (
        <form onSubmit={onInvite} className="card">
          <h3 className="font-heading text-lg font-semibold">Invite a member</h3>
          <p className="mb-4 text-sm text-muted">
            Any email address works — no CircleSafe account needed. They get a link that walks them
            through signing up and accepting. {circle.max_members - members.length} seat
            {circle.max_members - members.length === 1 ? "" : "s"} left.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com" className="input pl-10"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary btn-sm disabled:opacity-60">
              <UserPlus size={16} /> {busy ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {isOwner && circle.status !== "PENDING" && (
        <Alert tone="info">Membership is locked once a circle is active — this keeps the payout order fair.</Alert>
      )}

      {loading && !data && <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />}

      {data && members.length === 0 && (
        <EmptyState icon={Users} title="No members yet" message="Invite people by email to fill the circle." />
      )}

      {members.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4 shadow-card">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/12 font-heading font-bold text-primary">
                {m.name?.[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-body">{m.name}</span>
                  {m.user_id === user?.id && <span className="text-xs text-muted">(you)</span>}
                </div>
                <div className="truncate text-sm text-muted">{m.email}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge value={m.role} />
                {m.status === "INVITED" ? (
                  <Badge value="INVITED" />
                ) : (
                  <span className="text-xs text-muted">
                    {Number(m.payout_position) > 0 ? `Position ${m.payout_position}` : "No position"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
