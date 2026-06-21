"use client";

import { useEffect, useMemo, useState } from "react";
import { listPublicCards, type PublicCatalogEntry } from "@/lib/api";

type Card = {
  id: string;
  name: string;
  type: "Business" | "Personal";
  version: string;
  date: string;
  identifier: string;
  description: string;
  tags: string[];
  verified: boolean;
  typeBadge: "BUSINESS" | "PERSONAL";
  status: "Active";
};

const PAGE_SIZE = 6;

function parseEntry(entry: PublicCatalogEntry): Card {
  const isBusiness = entry.identifier.startsWith("urn:ai:domain:");
  // Derive the {scope}/{slug} display name from the URN + url, matching
  // the outshift "moonbakery.com/orders" / "personal/sara/card" pattern.
  let displayName = entry.displayName;
  if (isBusiness) {
    const match = entry.identifier.match(/^urn:ai:domain:([^:]+):agent:(.+)$/);
    if (match) displayName = `${match[1]}/${match[2]}`;
  } else {
    // personal: parse the public url path /personal/{handle}/{slug}.json
    try {
      const path = new URL(entry.url).pathname;
      const m = path.match(/^\/personal\/([^/]+)\/([^/.]+)\.json$/);
      if (m) displayName = `personal/${m[1]}/${m[2]}`;
    } catch {
      // leave displayName as the human-readable fallback
    }
  }

  return {
    id: entry.identifier,
    name: displayName,
    type: isBusiness ? "Business" : "Personal",
    version: "1.0",
    date: "Updated recently",
    identifier: entry.identifier,
    description: entry.description ?? "",
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    // Every entry in the public catalog is server-filtered to active +
    // public, so the verified check is safe for all of them.
    verified: true,
    typeBadge: isBusiness ? "BUSINESS" : "PERSONAL",
    status: "Active",
  };
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [identityFilter, setIdentityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPublicCards()
      .then((entries) => {
        if (cancelled) return;
        setCards(entries.map(parseEntry));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sidebar option lists derived from the live data.
  const identityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) set.add(c.type);
    return Array.from(set).sort();
  }, [cards]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) set.add(c.status);
    return Array.from(set).sort();
  }, [cards]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) for (const t of c.tags) set.add(t);
    return Array.from(set).sort().slice(0, 30);
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.identifier.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (identityFilter.length > 0 && !identityFilter.includes(c.type))
        return false;
      if (statusFilter.length > 0 && !statusFilter.includes(c.status))
        return false;
      if (
        tagFilter.length > 0 &&
        !c.tags.some((t) => tagFilter.includes(t))
      )
        return false;
      return true;
    });
  }, [cards, search, identityFilter, statusFilter, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageCards = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function toggle(
    list: string[],
    value: string,
    setter: (next: string[]) => void,
  ) {
    if (list.includes(value)) {
      setter(list.filter((v) => v !== value));
    } else {
      setter([...list, value]);
    }
    setPage(1);
  }

  const cardsHost = (() => {
    const base =
      process.env.NEXT_PUBLIC_HOST39_CARDS_URL ??
      process.env.NEXT_PUBLIC_HOST39_API_URL ??
      "";
    try {
      return new URL(base).hostname;
    } catch {
      return base || "the API";
    }
  })();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-ink-strong leading-tight">
          Explore
        </h2>
        <p className="mt-1 text-sm text-ink-medium max-w-3xl">
          Browse the secure directory of A2A agent cards hosted on host39.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          identityOptions={identityOptions}
          identity={identityFilter}
          onToggleIdentity={(v) => toggle(identityFilter, v, setIdentityFilter)}
          statusOptions={statusOptions}
          status={statusFilter}
          onToggleStatus={(v) => toggle(statusFilter, v, setStatusFilter)}
          tagOptions={tagOptions}
          tags={tagFilter}
          onToggleTag={(v) => toggle(tagFilter, v, setTagFilter)}
        />

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-strong h-[200px] rounded-card animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-card border border-line bg-surface-light p-8 text-center text-sm text-ink-medium">
              <p>
                Could not reach {cardsHost}. Check that the API is running.
              </p>
              <p className="mt-2 font-mono text-xs text-ink-weak">{error}</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-card border border-line bg-surface-light p-8 text-center text-sm text-ink-medium">
              No hosted cards registered yet.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {pageCards.map((card) => (
                  <AgentCardTile key={card.id} card={card} />
                ))}
              </div>

              {pageCards.length === 0 && (
                <div className="rounded-card border border-line bg-surface-light p-8 text-center text-sm text-ink-medium">
                  No hosted cards match your filters.
                </div>
              )}

              <Pagination
                page={currentPage}
                total={totalPages}
                onPage={(p) => setPage(p)}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function FilterSidebar(props: {
  search: string;
  onSearch: (v: string) => void;
  identityOptions: string[];
  identity: string[];
  onToggleIdentity: (v: string) => void;
  statusOptions: string[];
  status: string[];
  onToggleStatus: (v: string) => void;
  tagOptions: string[];
  tags: string[];
  onToggleTag: (v: string) => void;
}) {
  return (
    <aside className="lg:w-64 flex-shrink-0">
      <div className="bg-surface-strong rounded-card border border-line p-4 space-y-5 sticky top-24 max-h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
        <div className="flex-shrink-0">
          <label
            htmlFor="search"
            className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-1.5"
          >
            Search
          </label>
          <input
            type="text"
            id="search"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder="Filter by domain or handle..."
            className="w-full rounded-control border-2 border-line bg-surface-light px-3 py-2 text-sm text-ink placeholder:text-ink-weak focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex-shrink-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-2">
            Identity
          </span>
          <div className="space-y-1.5">
            {props.identityOptions.length === 0 ? (
              <span className="text-xs text-ink-weak">No options</span>
            ) : (
              props.identityOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-sm text-ink cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={props.identity.includes(opt)}
                    onChange={() => props.onToggleIdentity(opt)}
                    className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  <span>{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-2">
            Status
          </span>
          <div className="space-y-1.5">
            {props.statusOptions.length === 0 ? (
              <span className="text-xs text-ink-weak">No options</span>
            ) : (
              props.statusOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-sm text-ink cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={props.status.includes(opt)}
                    onChange={() => props.onToggleStatus(opt)}
                    className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  <span>{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-2">
            Tags
          </span>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {props.tagOptions.length === 0 ? (
              <span className="text-xs text-ink-weak">No tags yet</span>
            ) : (
              props.tagOptions.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 text-sm text-ink cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={props.tags.includes(tag)}
                    onChange={() => props.onToggleTag(tag)}
                    className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  <span className="truncate">{tag}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function AgentCardTile({ card }: { card: Card }) {
  return (
    <article
      className="bg-surface-light rounded-card border border-line/70 shadow-card p-4 hover:shadow-card-hover hover:border-line-strong transition cursor-pointer flex flex-col h-full gap-3"
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-ink-strong truncate">{card.name}</h3>
            {card.verified && (
              <span className="inline-flex flex-shrink-0" title="Verified">
                <svg
                  className="w-4 h-4 text-brand-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-ink-weak">
            Version {card.version} • {card.date}
          </div>
        </div>
        {card.typeBadge && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fdeccc] text-[#8a5a06] flex-shrink-0">
            {card.typeBadge}
          </span>
        )}
      </div>
      <p className="text-sm text-ink line-clamp-2 leading-relaxed">{card.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {card.tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-tag text-ink"
          >
            {t}
          </span>
        ))}
      </div>
    </article>
  );
}

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages: (number | "...")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < total - 2) pages.push("...");
    pages.push(total);
  }

  return (
    <nav className="flex items-center justify-center gap-2 mt-6 pb-4">
      <button
        type="button"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm font-medium rounded text-ink border-2 border-line bg-surface-light hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="px-2 py-1 text-sm text-ink-weak">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={`min-w-9 h-9 px-2 text-sm font-medium rounded-full transition ${
                p === page
                  ? "bg-brand-500 text-white"
                  : "text-ink hover:bg-surface-strong"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        type="button"
        onClick={() => onPage(Math.min(total, page + 1))}
        disabled={page === total}
        className="px-3 py-1.5 text-sm font-medium rounded text-ink border-2 border-line bg-surface-light hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Next
      </button>
    </nav>
  );
}
