"use client";

import { useEffect, useState } from "react";
import { ApiError, resendVerification } from "@/lib/api";

const ONE_SECOND_MS = 1000;

function retryAfterFrom(err: unknown): number | null {
  if (!(err instanceof ApiError) || !err.payload || typeof err.payload !== "object") return null;
  const value = (err.payload as Record<string, unknown>)["retry_after_seconds"];
  return typeof value === "number" ? value : null;
}

/** Shown to users whose email isn't verified — their cards aren't public until they click the link. */
export function EmailVerificationBanner({ email }: { email: string }) {
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), ONE_SECOND_MS);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onResend() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await resendVerification();
      setMessage(`Sent — check ${email}.`);
      setCooldown(res.retry_after_seconds);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the email. Please try again.");
      const retryAfter = retryAfterFrom(err);
      if (retryAfter) setCooldown(retryAfter);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm space-y-3">
      <div>
        <p className="font-semibold text-amber-900">Verify your email to publish your cards</p>
        <p className="text-sm text-amber-800">
          We sent a link to {email}. Your cards aren&apos;t public until you click it.
        </p>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}

      <button
        onClick={onResend}
        disabled={busy || cooldown > 0}
        className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Sending…" : cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend email"}
      </button>
    </div>
  );
}
