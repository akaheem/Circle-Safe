"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarClock, Coins, LogOut, Mail, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getInvitation, logout, respondInvitation } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { clearSession, getToken, useSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import type { Invitation } from "@/lib/types";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, ready } = useSession();

  const { data, error } = useAsync(() => getInvitation(token), [token]);
  const [responded, setResponded] = useState<Invitation | null>(null);
  const [busy, setBusy] = useState<"ACCEPT" | "DECLINE" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invitation = responded ?? data;

  async function respond(action: "ACCEPT" | "DECLINE") {
    setBusy(action);
    setActionError(null);
    try {
      const next = await respondInvitation({ token, action });
      setResponded(next);
      if (action === "ACCEPT") router.push(`/circles/${next.circle_id ?? invitation?.circle_id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not respond to the invitation");
      setBusy(null);
    }
  }

  /** Sign out here rather than at /login so the invite token survives the round trip. */
  async function onSwitchAccount() {
    const current = getToken();
    try {
      if (current) await logout(current);
    } catch {
      /* ignore */
    }
    clearSession();
    router.replace(`/login?invite=${encodeURIComponent(token)}`);
  }

  if (error) {
    return (
      <div className="card">
        <h1 className="font-heading text-2xl font-bold">This invitation link doesn&apos;t work</h1>
        <Alert tone="error" className="mt-4">{error}</Alert>
        <p className="mt-4 text-sm text-muted">
          Invitation links last 14 days and can only be used once. Ask whoever invited you to send a
          fresh one.
        </p>
        <Link href="/login" className="btn-outline mt-6">Log in</Link>
      </div>
    );
  }

  if (!invitation) return <div className="h-64 animate-pulse rounded-2xl border border-line bg-white" />;

  const expired =
    invitation.status === "EXPIRED" ||
    (invitation.status === "PENDING" && new Date(invitation.expires_at).getTime() < Date.now());
  const inviter = invitation.inviter_name ?? "The circle owner";
  const emailMatches = user != null && user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <div className="space-y-5">
      <VerifyEmailBanner />

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Circle invitation</p>
            <h1 className="mt-1 font-heading text-2xl font-bold">
              {invitation.circle_name ?? "A savings circle"}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{inviter} invited you to join.</p>
          </div>
          {invitation.status !== "PENDING" && <Badge value={invitation.status} />}
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {invitation.contribution_amount != null && (
            <Detail
              icon={Coins}
              label="Contribution"
              value={`${formatMoney(invitation.contribution_amount, invitation.currency)} ${
                invitation.frequency === "WEEKLY" ? "weekly" : "monthly"
              }`}
            />
          )}
          {invitation.seats_left != null && (
            <Detail
              icon={Users}
              label="Seats left"
              value={`${invitation.seats_left} of ${invitation.max_members ?? "?"}`}
            />
          )}
          <Detail icon={Mail} label="Sent to" value={maskEmail(invitation.email)} />
          <Detail
            icon={CalendarClock}
            label={expired ? "Expired" : "Expires"}
            value={formatDate(invitation.expires_at)}
          />
        </dl>

        {actionError && <Alert tone="error" className="mt-5">{actionError}</Alert>}

        <div className="mt-6 border-t border-line pt-6">
          {invitation.status === "ACCEPTED" ? (
            <>
              <p className="text-sm text-muted">
                You have already accepted this invitation — you&apos;re a member of this circle.
              </p>
              <Link href={`/circles/${invitation.circle_id}`} className="btn-primary mt-4">
                Open the circle
              </Link>
            </>
          ) : invitation.status === "DECLINED" ? (
            <p className="text-sm text-muted">
              You declined this invitation. Ask {inviter} to send a new one if you have changed your mind.
            </p>
          ) : invitation.status === "CANCELLED" ? (
            <p className="text-sm text-muted">
              {inviter} cancelled this invitation, so it can no longer be accepted.
            </p>
          ) : expired ? (
            <p className="text-sm text-muted">
              This invitation expired on {formatDate(invitation.expires_at)}. Ask {inviter} to send a
              new one — it only takes them a moment.
            </p>
          ) : !ready ? (
            <div className="h-11 animate-pulse rounded-full bg-surface" />
          ) : !user ? (
            <>
              <p className="text-sm text-muted">
                Accepting takes an account. Use the address this invitation was sent to — the circle is
                held for that address, not for the link.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/register?invite=${encodeURIComponent(token)}`} className="btn-primary">
                  Create an account to accept
                </Link>
                <Link href={`/login?invite=${encodeURIComponent(token)}`} className="btn-outline">
                  Log in
                </Link>
              </div>
            </>
          ) : !emailMatches ? (
            <>
              <Alert tone="info">
                This invitation was sent to <b>{maskEmail(invitation.email)}</b>, but you are signed in
                as <b className="break-all">{user.email}</b>. Only the invited address can accept it.
              </Alert>
              <button onClick={onSwitchAccount} className="btn-outline mt-4">
                <LogOut size={16} /> Log out and use the invited address
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Accepting takes a payout position in the circle and you start contributing when it
                begins.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => respond("ACCEPT")}
                  disabled={busy !== null}
                  className="btn-primary disabled:opacity-60"
                >
                  {busy === "ACCEPT" ? "Joining…" : "Accept invitation"}
                </button>
                <button
                  onClick={() => respond("DECLINE")}
                  disabled={busy !== null}
                  className="btn-outline disabled:opacity-60"
                >
                  {busy === "DECLINE" ? "Declining…" : "Decline"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
      <Icon size={18} className="shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="truncate font-semibold text-body">{value}</dd>
      </div>
    </div>
  );
}

/** Enough of the address to recognise it, not enough to harvest it from a shared link. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  const tail = local.length > 2 ? local[local.length - 1] : "";
  return `${local[0]}***${tail}${email.slice(at)}`;
}
