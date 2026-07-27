"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { signUp } from "@/lib/api";
import { setSession } from "@/lib/auth";
import Alert from "@/components/ui/Alert";
import DemoModeBanner from "@/components/DemoModeBanner";
import type { User } from "@/lib/types";

/** `verify_url` is returned only when no mail provider is configured. */
type SignUpResult = User & { verify_url?: string };

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [created, setCreated] = useState<SignUpResult | null>(null);

  // Read the token from window, not useSearchParams, so this page still prerenders.
  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).get("invite"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const user = (await signUp({ name, email, password })) as SignUpResult;
      setSession(user);
      setCreated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div>
        <DemoModeBanner className="mb-6" />
        <Brand />

        <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck size={22} />
        </span>
        <h1 className="font-heading text-3xl font-bold">Check your email</h1>
        <p className="mt-2 text-muted">
          Your account is ready. We sent a confirmation link to{" "}
          <b className="break-all text-body">{created.email}</b> — open it to confirm the address.
          Creating and joining circles needs a confirmed address. The link lasts 24 hours.
        </p>

        {created.verify_url && (
          <Alert tone="info" className="mt-5">
            No mail provider is configured on this deployment, so use your link directly:{" "}
            <a href={created.verify_url} className="break-all font-semibold underline">
              {created.verify_url}
            </a>
          </Alert>
        )}

        <Link
          href={invite ? `/invite/${encodeURIComponent(invite)}` : "/dashboard"}
          className="btn-primary mt-8 w-full"
        >
          {invite ? "Continue to your invitation" : "Go to my dashboard"}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <DemoModeBanner className="mb-6" />
      <Brand />

      <h1 className="font-heading text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted">Start a transparent savings circle in minutes.</p>

      {invite && (
        <Alert tone="info" className="mt-5">
          You have a circle invitation waiting. Sign up with the address it was sent to and we&apos;ll
          take you straight there.
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Full name">
          <input
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Amara Okafor" className="input" autoComplete="name"
          />
        </Field>
        <Field label="Email">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" className="input" autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters" className="input" autoComplete="new-password"
          />
        </Field>
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login"}
          className="font-semibold text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="mb-8 flex items-center gap-2.5 font-heading text-xl font-bold lg:hidden">
      <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent" />
      CircleSafe
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-body">{label}</span>
      {children}
    </label>
  );
}
