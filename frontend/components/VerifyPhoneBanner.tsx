"use client";

import { useEffect, useState } from "react";
import { PhoneIcon, X } from "lucide-react";
import { sendPhoneOtp, verifyPhoneOtp, USE_MOCK } from "@/lib/api";
import { useSession } from "@/lib/auth";
import Alert from "@/components/ui/Alert";

const DISMISS_KEY = "circlesafe_phone_dismissed";

export default function VerifyPhoneBanner({ className = "" }: { className?: string }) {
  const { user, ready } = useSession();

  const [dismissed, setDismissed] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"idle" | "otp-sent" | "verified">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  // Pre-fill phone from user profile.
  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  if (!ready || !user || user.phone_verified_at || dismissed) return null;

  async function onSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.startsWith("+")) {
      setError("Phone number must include the country code, e.g. +234...");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await sendPhoneOtp(phone);
      setStep("otp-sent");
      setSuccessMsg("OTP sent to your WhatsApp number. Check your messages.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit code you received on WhatsApp");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneOtp({ phone, otp });
      setStep("verified");
      setSuccessMsg("WhatsApp number verified! You can now create and join circles.");
      // The layout will re-render and hide this banner on next page load since
      // the user object won't have phone_verified_at until they re-fetch me().
      // We force dismiss so the UI responds immediately.
      setTimeout(() => onDismiss(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  function onDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function onReset() {
    setStep("idle");
    setError(null);
    setSuccessMsg(null);
    setOtp("");
  }

  // In mock mode, auto-verify so the demo flow isn't blocked.
  if (USE_MOCK) {
    return (
      <div className={`rounded-2xl border border-accent/40 bg-accent/10 p-4 ${className}`}>
        <div className="flex flex-wrap items-start gap-3">
          <PhoneIcon size={20} className="mt-0.5 shrink-0 text-accent-dark" />
          <div className="min-w-0 flex-1 text-sm text-body">
            <p className="font-heading font-semibold text-accent-dark">
              Verify your WhatsApp number
            </p>
            <p className="mt-1">
              Demo mode: WhatsApp verification is simulated. You can proceed without it.
            </p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Hide this reminder"
            className="grid h-8 w-8 place-items-center rounded-full text-accent-dark/70 transition-colors hover:bg-accent/20 hover:text-accent-dark"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-accent/40 bg-accent/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-3">
        <PhoneIcon size={20} className="mt-0.5 shrink-0 text-accent-dark" />
        <div className="min-w-0 flex-1 text-sm text-body">
          <p className="font-heading font-semibold text-accent-dark">
            Verify your WhatsApp number to create or join circles
          </p>

          {step === "verified" ? (
            <p className="mt-2 text-primary-dark font-medium">
              {successMsg || "WhatsApp number verified! You can now create and join circles."}
            </p>
          ) : step === "otp-sent" ? (
            <form onSubmit={onVerifyOtp} className="mt-3 space-y-3">
              {error && <Alert tone="error">{error}</Alert>}
              {successMsg && <p className="text-primary-dark">{successMsg}</p>}
              <p className="text-muted">
                We sent a 6-digit code to <b>{phone}</b>. Enter it below:
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  className="input w-32 text-center text-lg tracking-widest"
                  autoComplete="one-time-code"
                />
                <button type="submit" disabled={busy || otp.length !== 6}
                  className="btn-primary btn-sm disabled:opacity-60"
                >
                  {busy ? "Verifying…" : "Verify"}
                </button>
              </div>
              <button type="button" onClick={onReset} className="text-xs text-muted underline hover:text-body">
                Use a different number
              </button>
            </form>
          ) : (
            <form onSubmit={onSendOtp} className="mt-3 space-y-3">
              {error && <Alert tone="error">{error}</Alert>}
              <p className="text-muted">
                Enter your WhatsApp number with the country code to receive a verification code.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2348012345678" className="input w-56"
                  autoComplete="tel"
                />
                <button type="submit" disabled={busy} className="btn-primary btn-sm disabled:opacity-60">
                  {busy ? "Sending…" : "Send OTP"}
                </button>
              </div>
              {user.phone && user.phone !== phone && (
                <p className="text-xs text-muted">
                  Previously saved: {user.phone}. Enter a new number to update it.
                </p>
              )}
            </form>
          )}
        </div>

        {step !== "otp-sent" && (
          <button
            onClick={onDismiss}
            aria-label="Hide this reminder"
            className="grid h-8 w-8 place-items-center rounded-full text-accent-dark/70 transition-colors hover:bg-accent/20 hover:text-accent-dark"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
