"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MOCK_LOGIN, googleSignIn, signIn, USE_MOCK } from "@/lib/api";
import { setSession } from "@/lib/auth";
import Alert from "@/components/ui/Alert";
import DemoModeBanner from "@/components/DemoModeBanner";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; width?: string },
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Read the token from window, not useSearchParams, so this page still prerenders.
  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).get("invite"));
  }, []);

  // Initialize Google Sign-In button.
  useEffect(() => {
    if (USE_MOCK) return; // No Google in demo mode
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
    if (!clientId || !googleBtnRef.current) return;

    // Load the GIS library if not already loaded.
    if (!window.google) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleButton();
      document.body.appendChild(script);
    } else {
      initGoogleButton();
    }

    function initGoogleButton() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            setError("Google sign-in failed — no credential received");
            return;
          }
          setGoogleLoading(true);
          setError(null);
          try {
            const user = await googleSignIn(response.credential);
            setSession(user);
            router.push(invite ? `/invite/${encodeURIComponent(invite)}` : "/dashboard");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign-in failed");
            setGoogleLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: "400",
      });
    }
  }, [USE_MOCK, invite, router]);

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

      {!USE_MOCK && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <div className="mt-6">
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted">Or continue with</span>
            </div>
          </div>
          <div ref={googleBtnRef} className="flex justify-center">
            {googleLoading && <p className="text-sm text-muted">Signing in with Google…</p>}
          </div>
        </div>
      )}

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
