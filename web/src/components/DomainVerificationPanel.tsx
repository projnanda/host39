"use client";

import { useState } from "react";
import { ApiError, requestDomainChallenge, verifyDomain } from "@/lib/api";
import type { DomainChallenge } from "@/lib/api";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}

/**
 * Shown to SMB accounts whose domain isn't verified yet. Their cards are not
 * publicly served until they publish the DNS TXT record and verify it.
 */
export function DomainVerificationPanel({ domain, onVerified }: { domain: string; onVerified: () => void }) {
  const [challenge, setChallenge] = useState<DomainChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getRecord() {
    setBusy(true);
    setError(null);
    try {
      setChallenge(await requestDomainChallenge());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkRecord() {
    setBusy(true);
    setError(null);
    try {
      const res = await verifyDomain();
      if (res.domain_verified) onVerified();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm space-y-3">
      <div>
        <p className="font-semibold text-amber-900">Verify you own {domain}</p>
        <p className="text-sm text-amber-800">
          Your cards under /{domain}/ are not public until you prove domain ownership with a DNS TXT record.
        </p>
      </div>

      {challenge && (
        <dl className="space-y-1 rounded-2xl border border-amber-200 bg-white p-4 font-mono text-xs text-slate-700">
          <div><dt className="inline text-slate-400">Type: </dt><dd className="inline">{challenge.record_type}</dd></div>
          <div><dt className="inline text-slate-400">Name: </dt><dd className="inline break-all">{challenge.record_name}</dd></div>
          <div><dt className="inline text-slate-400">Value: </dt><dd className="inline break-all">{challenge.record_value}</dd></div>
          <div><dt className="inline text-slate-400">Expires: </dt><dd className="inline">{new Date(challenge.expires_at).toLocaleString()}</dd></div>
        </dl>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={getRecord}
          disabled={busy}
          className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {challenge ? "Get a new record" : "Get DNS record"}
        </button>
        {challenge && (
          <button
            onClick={checkRecord}
            disabled={busy}
            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Verify"}
          </button>
        )}
      </div>
    </div>
  );
}
