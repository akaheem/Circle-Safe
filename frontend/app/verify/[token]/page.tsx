"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleCheck, Loader, MailWarning } from "lucide-react";
import { resendVerification, verifyEmail } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { getSession, setSession, useSession } from "@/lib/auth";
import Alert from "@/components/ui/Alert";

/** `verify_url` is returned only when no mail provider is configured. */
type ResendResult = { sent: boolean; verify_url?: string };

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const { user, ready } = useSession();
  const { data, error } = useAsync(() => verifyEmail(token), [token]);

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<ResendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Keep the stored session in step so the "confirm your email" banner stops showing.
  useEffect(() => {
    if (!data?.verified) return;
    const session = getSession();
    if (session && !session.user.email_verified_at) {
      setSession({ ...session.user, email_verified_at: new Date().toISOString() });
    }
  }, [data]);

  async function onResend() {
    setBusy(true);
    setSendError(null);
    try {
      setSent((await resendVerification()) as ResendResult);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send a new link");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return (
      <div className="card text-center">
        <Loader size={22} className="mx-auto animate-spin text-primary" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Confirming your email…</h1>
        <p className="mt-2 text-sm text-muted">One moment.</p>
      </div>
    );
  }

  if (data?.verified) {
    return (
      <div className="card">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CircleCheck size={22} />
        </span>
        <h1 className="mt-5 font-heading text-2xl font-bold">Email confirmed</h1>
        <p className="mt-2 text-muted">
          <b className="break-all text-body">{data.email}</b> is confirmed. You can create circles and
          join the ones you are invited to.
        </p>
        <Link href="/dashboard" className="btn-primary mt-7 w-full">
          Go to my dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-dark">
        <MailWarning size={22} />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-bold">That link didn&apos;t work</h1>
      <p className="mt-2 text-muted">
        {error ?? "The link is no longer valid."} Confirmation links last 24 hours and work once, so
        an older email may have expired or already been used.
      </p>

      {sent && (
        <Alert tone="success" className="mt-5">
          A new link is on its way.
          {sent.verify_url && (
            <>
              {" "}No mail provider is configured, so use it directly:{" "}
              <a href={sent.verify_url} className="break-all font-semibold underline">
                {sent.verify_url}
              </a>
            </>
          )}
        </Alert>
      )}
      {sendError && <Alert tone="error" className="mt-5">{sendError}</Alert>}

      <div className="mt-7 flex flex-wrap gap-3">
        {ready && user ? (
          <button onClick={onResend} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Sending…" : "Send me a new link"}
          </button>
        ) : (
          <Link href="/login" className="btn-primary">
            Log in to get a new link
          </Link>
        )}
        <Link href="/dashboard" className="btn-outline">
          My dashboard
        </Link>
      </div>
    </div>
  );
}
