"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, createCard, getMe, getPublicUrl } from "@/lib/api";
import type { Me } from "@/lib/api";
import { clearAuthToken } from "@/lib/auth";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

interface FormState {
  slug: string;
  display_name: string;
  description: string;
  runtime_url: string;
  provider_name: string;
  provider_url: string;
  version: string;
  streaming: boolean;
  pushNotifications: boolean;
  authScheme: string;
  skillsJson: string;
  is_public: boolean;
}

// ── Shared primitives (outshift utility classes) ──────────────────────────────

const infoCardClass =
  "bg-surface-light rounded-card border border-line p-6 shadow-card";

const inputClass =
  "w-full h-10 rounded-control border-2 border-line bg-surface-light px-3 text-sm text-ink placeholder:text-ink-weak focus:outline-none focus:border-brand-500 transition-colors";

const textareaClass =
  "w-full rounded-control border-2 border-line bg-surface-light px-3 py-2 text-sm text-ink placeholder:text-ink-weak focus:outline-none focus:border-brand-500 transition-colors resize-none";

const primaryBtnClass =
  "inline-flex items-center justify-center h-9 rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-60";

const secondaryBtnClass =
  "inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-sm font-medium text-ink hover:border-line-strong transition";

const microLabelClass =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-ink-weak";

// ── Defaults per identity type ────────────────────────────────────────────────

function defaultsForMe(me: Me): Partial<FormState> {
  if (me.identity_type === "domain") {
    return {
      provider_name: me.display_name ?? "",
      provider_url:  me.domain ? `https://${me.domain}` : "",
      authScheme:    "Bearer",
    };
  }
  return {
    slug:       "agent",
    authScheme: "none",
  };
}

// ── Context (SMB vs personal) ─────────────────────────────────────────────────

function ctx(me: Me | null) {
  const isSmb = me?.identity_type === "domain";
  return {
    isSmb,
    slugPlaceholder:    isSmb ? "orders"                          : "agent",
    slugHint:           isSmb
      ? 'Short name for this specific agent - e.g. "orders", "support", "tracking".'
      : 'A simple identifier for your card - e.g. "agent", "assistant".',
    runtimePlaceholder: isSmb ? "https://my-agent.aws.example.com" : "https://my-agent.railway.app",
    runtimeHint:        isSmb
      ? "The A2A endpoint where your business agent runs (AWS, Azure, GCP, etc.)."
      : "Where your personal agent is hosted (Railway, Vercel, Render, etc.). Optional.",
    providerHint:       isSmb
      ? "Your company name and website - pre-filled from your registered domain."
      : "Optional - leave blank if you are the provider.",
    authHint:           isSmb
      ? "How callers must authenticate to use this agent."
      : "Personal agents usually require user consent or no auth for public actions.",
    skillsHint:         isSmb
      ? "Business capabilities this agent exposes (place order, check status, etc.)."
      : "Skills your personal agent has. Leave blank if general-purpose.",
  };
}

// ── Shared field ──────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text",
  hint, error, mono, textarea, optional,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; error?: string;
  mono?: boolean; textarea?: boolean; optional?: boolean;
}) {
  const base = cn(
    textarea ? textareaClass : inputClass,
    mono && "font-mono",
    error && "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)]",
  );
  return (
    <label className="block">
      <span className={microLabelClass}>
        {label}
        {optional && <span className="ml-1 font-normal normal-case tracking-normal text-ink-weak">(optional)</span>}
      </span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} rows={4} className={base} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} className={base} />
      )}
      {error
        ? <p className="mt-1 text-[11px] text-[color:var(--color-danger)]">{error}</p>
        : hint
          ? <p className="mt-1 text-[11px] text-ink-weak">{hint}</p>
          : null}
    </label>
  );
}

// ── Identity badge ────────────────────────────────────────────────────────────

function IdentityBadge({ me, slug }: { me: Me; slug: string }) {
  const isSmb = me.identity_type === "domain";
  const owner = isSmb ? (me.domain ?? me.email) : me.email;
  const previewSlug = slug || (isSmb ? "orders" : "agent");
  const url = getPublicUrl(me.identity_type, owner, previewSlug, me.handle);

  return (
    <div className={cn(
      "rounded-card border px-4 py-3 flex items-start gap-3",
      isSmb
        ? "border-line-strong bg-brand-200"
        : "border-line-strong bg-accent-teal",
    )}>
      <div className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
        isSmb ? "bg-brand-500" : "bg-accent-teal-ink",
      )}>
        {isSmb ? "B" : "P"}
      </div>
      <div className="min-w-0">
        <p className={cn(
          "text-[10px] font-bold uppercase tracking-wide",
          isSmb ? "text-brand-800" : "text-accent-teal-ink",
        )}>
          {isSmb ? "Business" : "Personal"}
        </p>
        <p className={cn(
          "text-xs font-semibold",
          isSmb ? "text-brand-800" : "text-accent-teal-ink",
        )}>
          {isSmb ? me.domain : `@${me.handle}`}
        </p>
        <p className={cn(
          "mt-0.5 break-all font-mono text-[11px]",
          isSmb ? "text-brand-800/80" : "text-accent-teal-ink/80",
        )}>
          {url}
        </p>
      </div>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ["Basic", "Runtime", "Capabilities", "Review"];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {([1, 2, 3, 4] as Step[]).map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
            s === current
              ? "bg-brand-500 text-white"
              : s < current
                ? "bg-accent-teal text-accent-teal-ink"
                : "border border-line bg-surface-light text-ink-weak",
          )}>
            {s < current ? "✓" : s}
          </div>
          {i < 3 && (
            <div className={cn(
              "h-px w-8 transition",
              s < current ? "bg-accent-teal-ink" : "bg-line"
            )} />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs font-medium text-ink-medium">
        {STEP_LABELS[(current - 1)]}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewCardPage() {
  useRequireAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const [form, setForm] = useState<FormState>({
    slug: "",
    display_name: "",
    description: "",
    runtime_url: "",
    provider_name: "",
    provider_url: "",
    version: "1.0",
    streaming: false,
    pushNotifications: false,
    authScheme: "none",
    skillsJson: "",
    is_public: true,
  });

  useEffect(() => {
    getMe()
      .then((data) => {
        setMe(data);
        if (!defaultsApplied) {
          setForm((prev) => ({ ...prev, ...defaultsForMe(data) }));
          setDefaultsApplied(true);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearAuthToken();
          router.replace("/login");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const c = ctx(me);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateSlug(value: string): string | null {
    if (!value) return "Required.";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
      return "Lowercase letters, numbers, and hyphens only. Must start with a letter or number.";
    }
    return null;
  }

  function nextStep() {
    if (step === 1) {
      const err = validateSlug(form.slug);
      if (err) { setSlugError(err); return; }
      if (!form.display_name.trim()) { setError("Display name is required."); return; }
      setSlugError(null);
    }
    setError(null);
    setStep((s) => Math.min(s + 1, 4) as Step);
  }

  function prevStep() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1) as Step);
  }

  async function onSubmit() {
    let skills: unknown[] = [];
    if (form.skillsJson.trim()) {
      try {
        const parsed = JSON.parse(form.skillsJson);
        if (!Array.isArray(parsed)) { setError("Skills must be a JSON array."); return; }
        skills = parsed;
      } catch {
        setError("Invalid JSON in skills field."); return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await createCard({
        slug:           form.slug,
        display_name:   form.display_name,
        description:    form.description || undefined,
        runtime_url:    form.runtime_url || undefined,
        version:        form.version || "1.0",
        capabilities:   { streaming: form.streaming, pushNotifications: form.pushNotifications },
        authentication: { schemes: [form.authScheme] },
        skills,
        provider_name:  form.provider_name || undefined,
        provider_url:   form.provider_url || undefined,
        is_public:      form.is_public,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create card.");
    } finally {
      setLoading(false);
    }
  }

  const DEFAULT_SKILLS = `[
  {
    "name": "${c.isSmb ? "placeOrder" : "assist"}",
    "description": "${c.isSmb ? "Place a new order" : "Help with a task"}"
  }
]`;

  return (
    <PageShell
      title="New agent card"
      description="Create an A2A agent card and publish it at a stable public URL."
    >
      <div className="max-w-lg space-y-5">

        {/* Identity badge - always visible */}
        {me && <IdentityBadge me={me} slug={form.slug} />}

        <div className={infoCardClass}>
          <StepIndicator current={step} />

          {/* ── Step 1: Basic ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field
                label="Slug"
                value={form.slug}
                onChange={(v) => { set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(null); }}
                placeholder={c.slugPlaceholder}
                hint={c.slugHint}
                error={slugError ?? undefined}
                mono
              />

              <Field
                label="Display name"
                value={form.display_name}
                onChange={(v) => set("display_name", v)}
                placeholder={c.isSmb ? "Moon Bakery Orders Agent" : "My Personal Agent"}
              />

              <Field
                label="Description"
                value={form.description}
                onChange={(v) => set("description", v)}
                placeholder={
                  c.isSmb
                    ? "Handles order placement, menu lookup, and pickup scheduling."
                    : "A personal AI assistant for productivity and daily tasks."
                }
                textarea
                optional
              />
            </div>
          )}

          {/* ── Step 2: Runtime ── */}
          {step === 2 && (
            <div className="space-y-4">
              <Field
                label="Runtime URL"
                value={form.runtime_url}
                onChange={(v) => set("runtime_url", v)}
                placeholder={c.runtimePlaceholder}
                hint={c.runtimeHint}
                type="url"
                mono
                optional
              />

              <Field
                label="Provider name"
                value={form.provider_name}
                onChange={(v) => set("provider_name", v)}
                placeholder={c.isSmb ? "Moon Bakery" : "John"}
                hint={c.providerHint}
                optional
              />

              <Field
                label="Provider URL"
                value={form.provider_url}
                onChange={(v) => set("provider_url", v)}
                placeholder={c.isSmb ? `https://${me?.domain ?? "moonbakery.com"}` : "https://john.dev"}
                type="url"
                mono
                optional
              />

              <Field
                label="Version"
                value={form.version}
                onChange={(v) => set("version", v)}
                placeholder="1.0"
                mono
                optional
              />
            </div>
          )}

          {/* ── Step 3: Capabilities & Auth ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <span className={microLabelClass}>
                  Capabilities
                </span>
                <div className="space-y-2 rounded-control border border-line p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={form.streaming}
                      onChange={(e) => set("streaming", e.target.checked)}
                      className="rounded border-line-strong text-brand-500 focus:ring-brand-500" />
                    <div>
                      <span className="text-sm text-ink">Streaming</span>
                      <p className="text-[11px] text-ink-weak">Agent streams responses incrementally.</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={form.pushNotifications}
                      onChange={(e) => set("pushNotifications", e.target.checked)}
                      className="rounded border-line-strong text-brand-500 focus:ring-brand-500" />
                    <div>
                      <span className="text-sm text-ink">Push notifications</span>
                      <p className="text-[11px] text-ink-weak">Agent can push updates to callers.</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={form.is_public}
                      onChange={(e) => set("is_public", e.target.checked)}
                      className="rounded border-line-strong text-brand-500 focus:ring-brand-500" />
                    <div>
                      <span className="text-sm text-ink">Public</span>
                      <p className="text-[11px] text-ink-weak">Accessible at the public URL. Uncheck to keep private.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <span className={microLabelClass}>
                  Authentication scheme
                </span>
                <select value={form.authScheme} onChange={(e) => set("authScheme", e.target.value)}
                  className={inputClass}>
                  <option value="none">None - public access</option>
                  <option value="Bearer">Bearer token</option>
                  <option value="OAuth2">OAuth 2.0</option>
                  <option value="ApiKey">API key</option>
                  {!c.isSmb && <option value="user_consent">User consent required</option>}
                </select>
                <p className="mt-1 text-[11px] text-ink-weak">{c.authHint}</p>
              </div>

              <Field
                label="Skills"
                value={form.skillsJson}
                onChange={(v) => set("skillsJson", v)}
                placeholder={DEFAULT_SKILLS}
                hint={c.skillsHint}
                textarea
                mono
                optional
              />
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && me && (
            <div className="space-y-4">
              {/* URL highlight */}
              <div className={cn(
                "rounded-card border p-4",
                c.isSmb
                  ? "border-line-strong bg-brand-200"
                  : "border-line-strong bg-accent-teal",
              )}>
                <p className={cn(
                  "mb-1 text-[10px] font-bold uppercase tracking-wide",
                  c.isSmb ? "text-brand-800" : "text-accent-teal-ink",
                )}>
                  Public URL
                </p>
                <code className={cn(
                  "break-all font-mono text-sm",
                  c.isSmb ? "text-brand-800" : "text-accent-teal-ink",
                )}>
                  {getPublicUrl(
                    me.identity_type,
                    me.identity_type === "domain" ? (me.domain ?? me.email) : me.email,
                    form.slug,
                    me.handle
                  )}
                </code>
              </div>

              <dl className="divide-y divide-line">
                {[
                  { label: "Slug",               value: form.slug,                           mono: true  },
                  { label: "Display name",        value: form.display_name,                   mono: false },
                  { label: "Description",         value: form.description || "-",             mono: false },
                  { label: "Runtime URL",         value: form.runtime_url || "-",             mono: true  },
                  { label: "Provider",            value: form.provider_name || "-",           mono: false },
                  { label: "Provider URL",        value: form.provider_url || "-",            mono: true  },
                  { label: "Version",             value: form.version,                        mono: true  },
                  { label: "Streaming",           value: form.streaming ? "Yes" : "No",       mono: false },
                  { label: "Push notifications",  value: form.pushNotifications ? "Yes" : "No", mono: false },
                  { label: "Auth",                value: form.authScheme,                     mono: true  },
                  { label: "Visibility",          value: form.is_public ? "Public" : "Private", mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="shrink-0 text-xs text-ink-weak">{label}</dt>
                    <dd className={cn("text-right text-sm text-ink", mono && "font-mono")}>{value}</dd>
                  </div>
                ))}
              </dl>

              {form.skillsJson.trim() && (
                <div className="rounded-control border border-line bg-surface-strong p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-weak">Skills</p>
                  <pre className="overflow-x-auto font-mono text-xs text-ink">{form.skillsJson}</pre>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-control border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-4 py-2.5 text-sm text-[color:var(--color-danger)]">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {step > 1 ? (
              <button onClick={prevStep} className={secondaryBtnClass}>
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button onClick={nextStep} className={primaryBtnClass}>
                Continue →
              </button>
            ) : (
              <button onClick={onSubmit} disabled={loading} className={primaryBtnClass}>
                {loading ? "Creating…" : "Create card"}
              </button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
