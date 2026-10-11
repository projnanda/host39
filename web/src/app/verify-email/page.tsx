"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, verifyEmail } from "@/lib/api";

type Status = "verifying" | "verified" | "failed";

function VerifyEmailInner() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "failed");
  const [error, setError] = useState<string | null>(token ? null : "This verification link is missing its token.");
  // Tokens are single-use: guard against React running the effect twice.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    verifyEmail(token)
      .then(() => setStatus("verified"))
      .catch((err) => {
        setStatus("failed");
        setError(err instanceof ApiError ? err.message : "Could not verify your email. Please try again.");
      });
  }, [token]);

  return (
    <PageShell title="Verify email" description="">
      <div className="max-w-xl space-y-4">
        {status === "verifying" && (
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm text-sm text-slate-400">
            Verifying…
          </div>
        )}

        {status === "verified" && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
            Your email is verified — your public agent cards are now live.
          </div>
        )}

        {status === "failed" && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            {error}
            <p className="mt-2 text-sm">Sign in and use “Resend email” on your dashboard to get a new link.</p>
          </div>
        )}

        {status !== "verifying" && (
          <Link
            href="/dashboard"
            className="inline-block rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to dashboard
          </Link>
        )}
      </div>
    </PageShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
