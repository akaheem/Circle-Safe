"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/api";
import { setSession } from "@/lib/auth";
import Alert from "@/components/ui/Alert";
import DemoModeBanner from "@/components/DemoModeBanner";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    // Phone is optional at signup — they can add it later for verification.
    const cleanPhone = phone.trim() || undefined;
    if (cleanPhone && !cleanPhone.startsWith("+")) {
      setError("Phone number must include the country code, e.g. +234...");
      return;
    }
    setLoading(true);
    try {
      const user = await signUp({ name, email, password, phone: cleanPhone });
      setSession(user);
      router.push(invite ? `/invite/${encodeURIComponent(invite)}` : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
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
        <Field label="WhatsApp number (optional — add it to verify your account)">
          <input
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348012345678" className="input" autoComplete="tel"
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
