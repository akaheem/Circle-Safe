"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Hourglass, Mail, MailOpen } from "lucide-react";
import { cancelJoinRequest, myInvitations, myJoinRequests, respondInvitation } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Countdown from "@/components/Countdown";
import type { Invitation } from "@/lib/types";

/** The list endpoint hides raw tokens by default; when one is present we can act from here. */
type InvitationRow = Invitation & { token?: string };

export default function RequestsPage() {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invitesQ = useAsync(() => myInvitations() as Promise<InvitationRow[]>, [version]);
  const requestsQ = useAsync(() => myJoinRequests(), [version]);

  const invites = invitesQ.data ?? [];
  const requests = requestsQ.data ?? [];
  const needsVerification = actionError != null && /verif/i.test(actionError);

  async function onRespond(invitation: InvitationRow, action: "ACCEPT" | "DECLINE") {
    if (!invitation.token) return;
    setBusy(invitation.id);
    setActionError(null);
    try {
      await respondInvitation({ token: invitation.token, action });
      if (action === "ACCEPT") router.push(`/circles/${invitation.circle_id}`);
      else setVersion((v) => v + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not respond to the invitation");
    } finally {
      setBusy(null);
    }
  }

  async function onCancel(requestId: string) {
    setBusy(requestId);
    setActionError(null);
    try {
      await cancelJoinRequest(requestId);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not cancel the request");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Invitations & requests</h1>
          <p className="mt-1 text-muted">Circles that invited you, and the ones you asked to join.</p>
        </div>
        <Link href="/circles/discover" className="btn-outline btn-sm">
          <Compass size={16} /> Discover circles
        </Link>
      </div>

      {needsVerification && (
        <Alert tone="info" className="mb-5">
          <b>Confirm your email first.</b> {actionError}
        </Alert>
      )}
      {actionError && !needsVerification && <Alert tone="error" className="mb-5">{actionError}</Alert>}

      <section className="mb-10">
        <h2 className="mb-4 font-heading text-xl font-semibold">Invitations to you</h2>

        {invitesQ.error && <Alert tone="error">{invitesQ.error}</Alert>}
        {!invitesQ.data && !invitesQ.error && (
          <div className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
        )}

        {invitesQ.data && invites.length === 0 && (
          <EmptyState
            icon={Mail}
            title="No invitations waiting"
            message="When a circle leader invites your email address, it lands here and in your inbox."
          />
        )}

        {invites.length > 0 && (
          <div className="space-y-3">
            {invites.map((inv) => (
              <div key={inv.id} className="card flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-lg font-semibold leading-snug">
                    {inv.circle_name ?? "A savings circle"}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {inv.inviter_name ?? "The circle leader"} invited {inv.email}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Invitation <Countdown at={inv.expires_at} mode="expiry" /> ·{" "}
                    {formatDate(inv.expires_at)}
                  </p>
                  {!inv.token && (
                    <p className="mt-3 text-sm text-muted">
                      Accepting takes the link we emailed to {inv.email}. Open that mail and the
                      invitation page does the rest.
                    </p>
                  )}
                </div>

                {inv.token && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      onClick={() => onRespond(inv, "ACCEPT")}
                      disabled={busy === inv.id}
                      className="btn-primary btn-sm disabled:opacity-60"
                    >
                      {busy === inv.id ? "Working…" : "Accept"}
                    </button>
                    <button
                      onClick={() => onRespond(inv, "DECLINE")}
                      disabled={busy === inv.id}
                      className="btn-outline btn-sm disabled:opacity-60"
                    >
                      Decline
                    </button>
                    <Link
                      href={`/invite/${inv.token}`}
                      className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-primary hover:text-primary-dark"
                    >
                      <MailOpen size={15} /> Open invitation
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">Your join requests</h2>

        {requestsQ.error && <Alert tone="error">{requestsQ.error}</Alert>}
        {!requestsQ.data && !requestsQ.error && (
          <div className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
        )}

        {requestsQ.data && requests.length === 0 && (
          <EmptyState
            icon={Hourglass}
            title="No join requests yet"
            message="Find an open circle and ask its leader for a seat."
            action={
              <Link href="/circles/discover" className="btn-primary btn-sm">
                <Compass size={16} /> Discover circles
              </Link>
            }
          />
        )}

        {requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-heading text-lg font-semibold leading-snug">
                      {r.circle_name ?? "A savings circle"}
                    </h3>
                    <Badge value={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">Sent {formatDate(r.created_at)}</p>
                  {r.message && <p className="mt-2 text-sm italic text-muted">“{r.message}”</p>}
                  {r.status === "REJECTED" && (
                    <p className="mt-2 text-sm text-muted">
                      The leader declined this one. You can ask again from discovery.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {r.status === "APPROVED" && (
                    <Link href={`/circles/${r.circle_id}`} className="btn-primary btn-sm">
                      Open circle <ArrowRight size={16} />
                    </Link>
                  )}
                  {r.status === "PENDING" && (
                    <button
                      onClick={() => onCancel(r.id)}
                      disabled={busy === r.id}
                      className="btn-danger btn-sm disabled:opacity-60"
                    >
                      {busy === r.id ? "Cancelling…" : "Cancel request"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
