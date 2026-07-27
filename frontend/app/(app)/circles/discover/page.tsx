"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarClock, Compass, Inbox, PlusCircle, Search, Users, Wallet,
} from "lucide-react";
import { cancelJoinRequest, listPublicCircles, myJoinRequests, requestToJoin } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import Countdown from "@/components/Countdown";
import { DemoModePill } from "@/components/DemoModeBanner";
import type { Circle } from "@/lib/types";

export default function DiscoverPage() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const circlesQ = useAsync(() => listPublicCircles(query), [query, version]);
  // Discovery rows carry a request status but no request id, so cancelling needs the caller's own list.
  const requestsQ = useAsync(() => myJoinRequests(), [version]);

  const circles = circlesQ.data ?? [];
  const openRequestFor = (circleId: string) =>
    requestsQ.data?.find((r) => r.circle_id === circleId && r.status === "PENDING") ?? null;

  async function onRequest(circle: Circle) {
    setBusy(circle.id);
    setActionError(null);
    setNotice(null);
    try {
      const message = notes[circle.id]?.trim();
      await requestToJoin({ circle_id: circle.id, message: message || undefined });
      setNotice(`Request sent. ${circle.owner_name ?? "The leader"} gets an email with your name${message ? " and note" : ""}.`);
      setNoteFor(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setBusy(null);
    }
  }

  async function onCancel(circle: Circle) {
    const request = openRequestFor(circle.id);
    if (!request) return;
    setBusy(circle.id);
    setActionError(null);
    setNotice(null);
    try {
      await cancelJoinRequest(request.id);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not cancel the request");
    } finally {
      setBusy(null);
    }
  }

  const needsVerification = actionError != null && /verif/i.test(actionError);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold">Discover circles</h1>
            <DemoModePill />
          </div>
          <p className="mt-1 text-muted">
            Open circles that haven&apos;t started yet. Ask to join and the leader decides.
          </p>
        </div>
        <Link href="/requests" className="btn-outline btn-sm">
          <Inbox size={16} /> My requests
        </Link>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name or what the circle saves for"
          aria-label="Search open circles"
          className="input pl-11"
        />
        {circlesQ.loading && circlesQ.data && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">Searching…</span>
        )}
      </div>

      {needsVerification && (
        <Alert tone="info" className="mb-5">
          <b>Confirm your email first.</b> {actionError}
        </Alert>
      )}
      {actionError && !needsVerification && <Alert tone="error" className="mb-5">{actionError}</Alert>}
      {notice && <Alert tone="success" className="mb-5">{notice}</Alert>}
      {circlesQ.error && <Alert tone="error" className="mb-5">{circlesQ.error}</Alert>}

      {!circlesQ.data && !circlesQ.error && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      )}

      {circlesQ.data && circles.length === 0 && (
        <EmptyState
          icon={Compass}
          title={query ? `No circles match “${query}”` : "Nothing open right now"}
          message={
            query
              ? "Try a shorter search, or start a circle of your own and invite people to it."
              : "Every open circle is either full or already running. Start your own and invite people while it waits."
          }
          action={
            query ? (
              <button onClick={() => setTerm("")} className="btn-outline btn-sm">Clear search</button>
            ) : (
              <Link href="/circles/new" className="btn-primary btn-sm">
                <PlusCircle size={16} /> Start a circle
              </Link>
            )
          }
        />
      )}

      {circles.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {circles.map((c) => {
            const total = Math.max(c.max_members ?? 0, 0);
            const members = c.members_count ?? 0;
            const seatsLeft = c.seats_left ?? Math.max(0, total - members);
            const status = c.my_request_status ?? null;
            const working = busy === c.id;

            return (
              <article key={c.id} className="card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-lg font-semibold leading-snug">{c.name}</h3>
                  {c.starts_at ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-dark">
                      <CalendarClock size={13} />
                      <Countdown at={c.starts_at} />
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-muted/12 px-2.5 py-1 text-xs font-semibold text-muted">
                      No start date
                    </span>
                  )}
                </div>

                {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.description}</p>}

                <p className="mt-3 text-sm text-muted">
                  Led by <span className="font-semibold text-body">{c.owner_name ?? "a member"}</span>
                </p>

                <div className="mt-4 space-y-2.5 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-primary" />
                    {formatMoney(c.contribution_amount, c.currency)}{" "}
                    <span className="lowercase">/ {c.frequency === "WEEKLY" ? "week" : "month"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
                  </div>
                </div>

                <div className="mb-5 mt-4">
                  <ProgressBar
                    value={total ? (members / total) * 100 : 0}
                    label={`${members} of ${total} members`}
                    caption={`${seatsLeft} open`}
                  />
                </div>

                <div className="mt-auto border-t border-line pt-4">
                  {status === "APPROVED" ? (
                    <Link href={`/circles/${c.id}`} className="btn-primary btn-sm w-full">
                      Open circle <ArrowRight size={16} />
                    </Link>
                  ) : status === "PENDING" ? (
                    <div>
                      <p className="mb-3 text-sm text-muted">
                        Waiting on {c.owner_name ?? "the leader"} to respond.
                      </p>
                      <div className="flex gap-2">
                        <button disabled className="btn-outline btn-sm flex-1 opacity-60">
                          Request pending
                        </button>
                        <button
                          onClick={() => onCancel(c)}
                          disabled={working || !openRequestFor(c.id)}
                          className="btn-danger btn-sm disabled:opacity-60"
                        >
                          {working ? "…" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {status === "REJECTED" && (
                        <p className="mb-3 text-sm text-muted">
                          Your last request was declined. You can ask again.
                        </p>
                      )}

                      {noteFor === c.id ? (
                        <div className="mb-3">
                          <label htmlFor={`note-${c.id}`} className="field-label">
                            Note to {c.owner_name ?? "the leader"}
                          </label>
                          <textarea
                            id={`note-${c.id}`}
                            rows={3}
                            maxLength={300}
                            value={notes[c.id] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                            placeholder="Say who you are and why you save. This goes into their email."
                            className="input"
                          />
                          <button
                            onClick={() => setNoteFor(null)}
                            className="mt-2 text-sm font-medium text-muted hover:text-body"
                          >
                            Hide note
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setNoteFor(c.id)}
                          className="mb-3 text-sm font-semibold text-primary hover:text-primary-dark"
                        >
                          {notes[c.id]?.trim() ? "Edit your note" : "Add a note to the leader"}
                        </button>
                      )}

                      <button
                        onClick={() => onRequest(c)}
                        disabled={working || seatsLeft <= 0}
                        className="btn-primary btn-sm w-full disabled:opacity-60"
                      >
                        {working ? "Sending…" : "Request to join"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
