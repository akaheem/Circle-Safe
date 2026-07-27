"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MOCK_LOGIN, signIn, USE_MOCK } from "@/lib/api";
import { setSession } from "@/lib/auth";
import Alert from "@/components/ui/Alert";
import DemoModeBanner from "@/components/DemoModeBanner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);

  // Read the token from window, not useSearchParams, so this page still prerenders.
  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).get("invite"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await signIn({ email, password });
      setSession(user);
      router.push(invite ? `/invite/${encodeURIComponent(invite)}` : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <DemoModeBanner className="mb-6" />

      <Link href="/" className="mb-8 flex items-center gap-2.5 font-heading text-xl font-bold lg:hidden">
        <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent" />
        CircleSafe
      </Link>

      <h1 className="font-heading text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-muted">Log in to manage your savings circles.</p>

      {invite && (
        <Alert tone="info" className="mt-5">
          You have a circle invitation waiting. Log in with the address it was sent to and we&apos;ll
          take you straight there.
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" className="input" autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" className="input" autoComplete="current-password"
          />
        </Field>
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? "Logging in…" : "Log in"}
        </button>
        {USE_MOCK && (
          <p className="text-center text-sm text-accent-dark">
            Demo login: <b>{MOCK_LOGIN.email}</b> / <b>{MOCK_LOGIN.password}</b>
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-muted">
        New to CircleSafe?{" "}
        <Link
          href={invite ? `/register?invite=${encodeURIComponent(invite)}` : "/register"}
          className="font-semibold text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
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
