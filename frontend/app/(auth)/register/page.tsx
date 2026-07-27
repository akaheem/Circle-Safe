"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const user = await signUp({ name, email, password });
      setSession(user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/" className="mb-8 flex items-center gap-2.5 font-heading text-xl font-bold lg:hidden">
        <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent" />
        CircleSafe
      </Link>

      <h1 className="font-heading text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted">Start a transparent savings circle in minutes.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
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
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
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
