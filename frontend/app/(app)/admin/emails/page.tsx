"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Check, ChevronDown, ChevronUp, Copy, Inbox, Mail, MailWarning, Search, Send,
} from "lucide-react";
import { adminListEmails } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { timeAgo } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import AdminGuard, { Pill } from "@/components/admin/AdminGuard";
import type { EmailRecord } from "@/lib/types";

const LINK_RE = /https?:\/\/[^\s<>"')\]]+/g;

function linksIn(body: string): string[] {
  return [...new Set(body.match(LINK_RE) ?? [])];
}

function StatusPill({ status }: { status: EmailRecord["status"] }) {
  if (status === "SENT") {
    return (
      <Pill tone="primary">
        <Send size={12} /> SENT
      </Pill>
    );
  }
  if (status === "FAILED") {
    return (
      <Pill tone="danger">
        <MailWarning size={12} /> FAILED
      </Pill>
    );
  }
  return (
    <Pill tone="accent">
      <Inbox size={12} /> LOGGED
    </Pill>
  );
}

export default function AdminEmailsPage() {
  return (
    <AdminGuard
      title="Email outbox"
      subtitle="The last 200 messages the platform produced, newest first."
    >
      <Outbox />
    </AdminGuard>
  );
}

function Outbox() {
  const { data, error } = useAsync(() => adminListEmails(), []);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data ?? []).filter(
      (e) => !q || `${e.to_email} ${e.subject} ${e.template} ${e.status}`.toLowerCase().includes(q),
    );
  }, [data, term]);

  const logged = (data ?? []).filter((e) => e.status === "LOGGED").length;
  const failed = (data ?? []).filter((e) => e.status === "FAILED").length;

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      setCopied(null); // clipboard blocked (insecure origin) — the text is on screen to select
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      <Alert tone="info">
        <b>LOGGED means no mail provider is configured.</b> The message was recorded here instead of
        delivered, and the link inside it still works — open a row, copy the link and send it on
        yourself. Set SMTP_URL (or SMTP_HOST) to have these delivered for real.
      </Alert>

      {failed > 0 && (
        <Alert tone="error">
          <b>
            {failed} message{failed === 1 ? "" : "s"} failed to send.
          </b>{" "}
          Open the row to read the provider error, then pass the link on by hand.
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter by recipient, subject or template"
            aria-label="Filter the outbox"
            className="input pl-11"
          />
        </div>
        {data && (
          <span className="text-sm text-muted">
            {rows.length === data.length
              ? `${data.length} message${data.length === 1 ? "" : "s"}`
              : `${rows.length} of ${data.length} messages`}
            {logged > 0 && ` · ${logged} logged only`}
          </span>
        )}
      </div>

      {!data && <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />}

      {data && rows.length === 0 && (
        <EmptyState
          icon={Mail}
          title={term ? `Nothing matches “${term.trim()}”` : "The outbox is empty"}
          message={
            term
              ? "Try the recipient's address, or a template name like INVITATION."
              : "Invitations, join requests, decisions and verification links all land here as they are produced."
          }
          action={
            term ? (
              <button onClick={() => setTerm("")} className="btn-outline btn-sm">Clear filter</button>
            ) : undefined
          }
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">To</th>
                <th className="px-5 py-3 font-semibold">Subject</th>
                <th className="px-5 py-3 font-semibold">Template</th>
                <th className="px-5 py-3 font-semibold">Recorded</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const expanded = open.has(e.id);
                const links = expanded ? linksIn(e.body) : [];

                return (
                  <Fragment key={e.id}>
                    <tr onClick={() => toggle(e.id)} className="cursor-pointer hover:bg-surface/40">
                      <td className="px-5 py-3.5"><StatusPill status={e.status} /></td>
                      <td className="px-5 py-3.5 font-medium text-body">{e.to_email}</td>
                      <td className="max-w-md px-5 py-3.5 text-muted">
                        <span className="line-clamp-1">{e.subject}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-muted">
                          {e.template}
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap px-5 py-3.5 text-muted"
                        title={new Date(e.created_at).toLocaleString()}
                      >
                        {timeAgo(e.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          aria-expanded={expanded}
                          aria-controls={`email-${e.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-primary hover:text-primary-dark"
                        >
                          {expanded ? "Hide" : "Read"}
                          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr id={`email-${e.id}`} className="bg-surface/50">
                        <td colSpan={6} className="px-5 py-4">
                          {e.status === "FAILED" && e.error && (
                            <Alert tone="error" className="mb-3">Delivery error: {e.error}</Alert>
                          )}

                          {links.length > 0 && (
                            <div className="mb-4 space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                                Links in this message
                              </div>
                              {links.map((url) => (
                                <div key={url} className="flex flex-wrap items-center gap-2">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all font-semibold text-primary hover:text-primary-dark"
                                  >
                                    {url}
                                  </a>
                                  <button
                                    onClick={() => copy(url, url)}
                                    className="btn-outline btn-sm shrink-0"
                                  >
                                    {copied === url ? (
                                      <><Check size={14} /> Copied</>
                                    ) : (
                                      <><Copy size={14} /> Copy link</>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-white p-4 font-sans text-sm text-body">
                            {e.body}
                          </pre>

                          <button onClick={() => copy(e.id, e.body)} className="btn-outline btn-sm mt-3">
                            {copied === e.id ? (
                              <><Check size={15} /> Copied</>
                            ) : (
                              <><Copy size={15} /> Copy whole message</>
                            )}
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
