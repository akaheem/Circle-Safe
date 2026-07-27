"use client";

import { useEffect, useState } from "react";
import { MailWarning, X } from "lucide-react";
import { me, resendVerification, USE_MOCK } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/lib/auth";

const DISMISS_KEY = "circlesafe_verify_dismissed";

/** `verify_url` comes back only when SMTP is unconfigured — then the link is the only way through. */
type ResendResult = { sent: boolean; verify_url?: string };

export default function VerifyEmailBanner({ className = "" }: { className?: string }) {
  const { user, ready } = useSession();
  const { data } = useAsync(
    () => (USE_MOCK || !ready || !user ? Promise.resolve(null) : me()),
    [ready, user?.id],
  );

  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<ResendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  async function onResend() {
    setBusy(true);
    setError(null);
    try {
      setSent((await resendVerification()) as ResendResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link");
    } finally {
      setBusy(false);
    }
  }

  function onDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!data || data.email_verified_at || dismissed) return null;

  return (
    <div className={`rounded-2xl border border-accent/40 bg-accent/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-3">
        <MailWarning size={20} className="mt-0.5 shrink-0 text-accent-dark" />
        <div className="min-w-0 flex-1 text-sm text-body">
          <p className="font-heading font-semibold text-accent-dark">
            Confirm your email to create or join circles
          </p>
          <p className="mt-1">
            We sent a link to <b className="break-all">{data.email}</b>. Open it and you are done.
          </p>

          {sent && (
            <p className="mt-2 text-primary-dark">
              Link sent again.
              {sent.verify_url && (
                <>
                  {" "}No mail provider is configured, so use this instead:{" "}
                  <a href={sent.verify_url} className="break-all font-semibold underline">
                    {sent.verify_url}
                  </a>
                </>
              )}
            </p>
          )}
          {error && <p className="mt-2 text-red-700">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onResend} disabled={busy} className="btn-outline btn-sm disabled:opacity-60">
            {busy ? "Sending…" : "Resend"}
          </button>
          <button
            onClick={onDismiss}
            aria-label="Hide this reminder"
            className="grid h-8 w-8 place-items-center rounded-full text-accent-dark/70 transition-colors hover:bg-accent/20 hover:text-accent-dark"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
