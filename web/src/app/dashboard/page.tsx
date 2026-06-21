"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, getMe, listCards, getPublicUrl } from "@/lib/api";
import type { Me, AgentCard } from "@/lib/api";
import { clearAuthToken } from "@/lib/auth";
import { useRequireAuth } from "@/hooks/useRequireAuth";

// Static info-card pattern (slightly more padding, no hover transform)
const infoCardClass =
  "bg-surface-light rounded-card border border-line p-6 shadow-card";

// Outshift exact card pattern (grid item, interactive)
const gridCardClass =
  "bg-surface-light rounded-card border border-line/70 shadow-card p-4 hover:shadow-card-hover hover:border-line-strong transition flex flex-col h-full gap-3";

export default function DashboardPage() {
  useRequireAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [cards, setCards] = useState<AgentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getMe(), listCards()])
      .then(([meData, cardsData]) => {
        if (cancelled) return;
        setMe(meData);
        setCards(cardsData);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearAuthToken();
          router.replace("/login");
        } else {
          setError("Could not load your data. Please try again.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [router]);

  function signOut() {
    clearAuthToken();
    router.replace("/");
  }

  async function copyUrl(url: string, cardId: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(cardId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <PageShell title="Dashboard" description="Loading your agent cards…">
        <div className={`${infoCardClass} text-sm text-ink-weak`}>
          Loading…
        </div>
      </PageShell>
    );
  }

  if (error || !me) {
    return (
      <PageShell title="Dashboard" description="">
        <div className="rounded-card border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-4 text-[color:var(--color-danger)]">
          {error ?? "Something went wrong."}
        </div>
      </PageShell>
    );
  }

  const isDomain = me.identity_type === "domain";
  const identityPillClass = isDomain
    ? "bg-brand-200 text-brand-800"
    : "bg-accent-teal text-accent-teal-ink";

  return (
    <PageShell
      title="Dashboard"
      description={`Signed in as ${me.email}`}
    >
      <div className="space-y-6">
        {/* Profile card */}
        <div className={`${infoCardClass} flex items-center justify-between`}>
          <div>
            <p className="font-semibold text-ink-strong">{me.display_name ?? me.email}</p>
            <p className="text-sm text-ink-medium">{me.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-surface-tag px-2.5 py-0.5 font-mono text-xs text-ink">
                @{me.handle}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${identityPillClass}`}>
                {isDomain ? `Business · ${me.domain}` : "Personal"}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-sm font-medium text-ink hover:border-line-strong transition"
          >
            Sign out
          </button>
        </div>

        {/* Agent cards */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-weak">
              Agent Cards
            </h2>
            <Link
              href="/dashboard/cards/new"
              className="inline-flex items-center justify-center h-9 rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition"
            >
              + New card
            </Link>
          </div>

          {cards.length === 0 ? (
            <div className={`${infoCardClass} text-center`}>
              <p className="text-sm text-ink-medium">
                You have no agent cards yet.
              </p>
              <Link
                href="/dashboard/cards/new"
                className="mt-4 inline-flex items-center justify-center h-9 rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition"
              >
                Create your first card
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => {
                const publicUrl = getPublicUrl(
                  me.identity_type,
                  me.identity_type === "domain" ? (me.domain ?? me.email) : me.email,
                  card.slug,
                  me.handle
                );

                const statusClass =
                  card.status === "active"
                    ? "bg-accent-teal text-accent-teal-ink"
                    : "bg-surface-tag text-ink-weak";

                return (
                  <article key={card.id} className={gridCardClass}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-ink-strong truncate">{card.display_name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                        {card.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-weak">/{card.slug}</span>
                      {!card.is_public && (
                        <span className="inline-flex items-center rounded-full bg-[#fdeccc] text-[#8a5a06] px-2.5 py-0.5 text-xs font-semibold">
                          Private
                        </span>
                      )}
                    </div>
                    {card.description && (
                      <p className="text-sm text-ink line-clamp-2 leading-relaxed">{card.description}</p>
                    )}

                    {/* Public URL */}
                    <div className="mt-auto flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-control border border-line bg-surface-strong px-3 py-1.5 font-mono text-xs text-ink-medium">
                        {publicUrl}
                      </code>
                      <button
                        onClick={() => copyUrl(publicUrl, card.id)}
                        className="shrink-0 inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-xs font-medium text-ink hover:border-line-strong transition"
                      >
                        {copiedId === card.id ? "Copied!" : "Copy"}
                      </button>
                      <Link
                        href={`/dashboard/cards/${card.id}`}
                        className="shrink-0 inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-xs font-medium text-ink hover:border-line-strong transition"
                      >
                        Edit
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
