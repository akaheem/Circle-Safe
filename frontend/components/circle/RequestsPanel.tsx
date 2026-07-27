"use client";

import { useState } from "react";
import { Ban, Check, Inbox, Mail, X } from "lucide-react";
import {
  cancelInvitation, listInvitations, listJoinRequests, me as fetchMe, respondJoinRequest,
} from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, timeAgo } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Countdown from "@/components/Countdown";
import type { Invitation, JoinRequest, PanelProps } from "@/lib/types";

/** Pending first, newest first inside each group — the rows that need a decision stay at the top. */
function byUrgency(a: { status: string; created_at: string }, b: { status: string; created_at: string }) {
  const pending = Number(b.status === "PENDING") - Number(a.status === "PENDING");
  return pending || b.created_at.localeCompare(a.created_at);
}

export default function RequestsPanel({ circleId, circle, me, version, onChanged }: PanelProps) {
  // This tab only renders for staff and admins, so no membership row already means a platform admin.
  // The role read covers the other case: an admin who is also an ordinary member of this circle.
  // An admin may answer the request queue, but cancelling an invite stays with the owner.
  const accountQ = useAsync(() => fetchMe(), []);
  const isOwner = me?.role === "OWNER";
  const isAdmin = !me || accountQ.data?.role === "ADMIN";
  const canSeeInvites = isOwner || isAdmin;
  const canDecide = canSeeInvites;

  const requestsQ = useAsync(() => listJoinRequests(circleId), [circleId, version]);
  const invitesQ = useAsync(
    () => (canSeeInvites ? listInvitations(circleId) : Promise.resolve([] as Invitation[])),
    [circleId, version, canSeeInvites],
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requests = [...(requestsQ.data ?? [])].sort(byUrgency);
  const invitations = [...(invitesQ.data ?? [])].sort(byUrgency);

  const seatsLeft = circle.seats_left ?? Math.max(0, circle.max_members - (circle.members_count ?? 0));
  const started = circle.status !== "PENDING";
  const full = seatsLeft <= 0;
  const blocked = started
    ? "The circle is already running, so the payout order is locked. New members would break it."
    : full
      ? "Every seat is taken. Raise the member limit in Rules & Order to make room."
      : null;
  const cannotDecideBecause = !canDecide
    ? "Only the circle owner answers join requests."
    : started
      ? "Approving is closed once a circle starts."
      : full
        ? "No seat left to give them."
        : null;

  async function onRespond(request: JoinRequest, action: "APPROVE" | "REJECT") {
    setBusyId(request.id);
    setActionError(null);
    setNotice(null);
    try {
      await respondJoinRequest({ request_id: request.id, action });
      setNotice(
        action === "APPROVE"
          ? `${request.name ?? "They"} joined the circle and got an email about it.`
          : `Declined. ${request.name ?? "They"} were emailed.`,
      );
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not respond to the request");
    } finally {
      setBusyId(null);
    }
  }

  async function onCancelInvite(id: string, email: string) {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await cancelInvitation(id);
      setNotice(`Invitation to ${email} cancelled. The link no longer works.`);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not cancel the invitation");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">Join requests</h2>
            <p className="text-sm text-muted">
              People who found this circle in discovery and asked for a seat.
            </p>
          </div>
          <span className="text-sm text-muted">
            {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
          </span>
        </div>

        {blocked && <Alert tone="info" className="mb-4">{blocked}</Alert>}
        {requestsQ.error && <Alert tone="error" className="mb-4">{requestsQ.error}</Alert>}

        {!requestsQ.data && !requestsQ.error && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-white" />
            ))}
          </div>
        )}

        {requestsQ.data && requests.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No join requests yet"
            message={
              circle.visibility === "PRIVATE"
                ? "This circle is private, so it stays out of discovery. Switch it to public in Rules & Order if you want people to ask to join."
                : "This circle is listed in discovery while it waits to start. Requests land here, and you get an email for each one."
            }
          />
        )}

        {requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((r) => {
              const working = busyId === r.id;
              const decidable = r.status === "PENDING" && !cannotDecideBecause;

              return (
                <article key={r.id} className="card flex flex-wrap items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/12 font-heading font-bold text-primary">
                    {r.name?.[0]?.toUpperCase() ?? "?"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-heading font-semibold text-body">{r.name ?? "A member"}</span>
                      <Badge value={r.status} />
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted">{r.email}</div>
                    {r.message && <p className="mt-2 text-sm italic text-muted">“{r.message}”</p>}
                    <p className="mt-2 text-xs text-muted">
                      Asked {timeAgo(r.created_at)} · {formatDate(r.created_at)}
                      {r.decided_at ? ` · answered ${formatDate(r.decided_at)}` : ""}
                    </p>
                  </div>

                  {r.status === "PENDING" && (
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onRespond(r, "APPROVE")}
                          disabled={working || !decidable}
                          title={cannotDecideBecause ?? undefined}
                          className="btn-primary btn-sm disabled:opacity-50"
                        >
                          <Check size={15} /> {working ? "Working…" : "Approve"}
                        </button>
                        <button
                          onClick={() => onRespond(r, "REJECT")}
                          disabled={working || !canDecide}
                          className="btn-danger btn-sm disabled:opacity-50"
                        >
                          <X size={15} /> Reject
                        </button>
                      </div>
                      {cannotDecideBecause && (
                        <span className="max-w-[15rem] text-right text-xs text-muted">
                          {cannotDecideBecause}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-heading text-xl font-semibold">Invitations</h2>
          <p className="text-sm text-muted">
            Invitations sent from the Members tab. Each link works for 14 days.
          </p>
        </div>

        {!canSeeInvites && (
          <Alert tone="info">Only the circle owner can see who has been invited.</Alert>
        )}
        {canSeeInvites && invitesQ.error && (
          <Alert tone="error" className="mb-4">{invitesQ.error}</Alert>
        )}

        {canSeeInvites && !invitesQ.data && !invitesQ.error && (
          <div className="h-28 animate-pulse rounded-2xl border border-line bg-white" />
        )}

        {canSeeInvites && invitesQ.data && invitations.length === 0 && (
          <EmptyState
            icon={Mail}
            title="No invitations sent"
            message="Invite people by email from the Members tab — they do not need a CircleSafe account first."
          />
        )}

        {invitations.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Sent</th>
                  <th className="px-5 py-3 font-semibold">Expires</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-medium text-body">{inv.email}</td>
                    <td className="px-5 py-3.5"><Badge value={inv.status} /></td>
                    <td className="px-5 py-3.5 text-muted">{formatDate(inv.created_at)}</td>
                    <td className="px-5 py-3.5 text-muted">
                      {formatDate(inv.expires_at)}
                      {inv.status === "PENDING" && (
                        <span className="ml-2 text-xs">
                          <Countdown at={inv.expires_at} mode="expiry" />
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.status === "PENDING" && isOwner && (
                        <button
                          onClick={() => onCancelInvite(inv.id, inv.email)}
                          disabled={busyId === inv.id}
                          className="btn-danger btn-sm disabled:opacity-50"
                        >
                          <Ban size={15} /> {busyId === inv.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
