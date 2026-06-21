"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, getCard, getMe, updateCard, deleteCard, getPublicUrl } from "@/lib/api";
import type { AgentCard, Me } from "@/lib/api";
import { clearAuthToken } from "@/lib/auth";
import { useRequireAuth } from "@/hooks/useRequireAuth";

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-weak">
      {children}
    </p>
  );
}

export default function EditCardPage() {
  useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [card, setCard] = useState<AgentCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Form state
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [runtimeUrl, setRuntimeUrl] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [version, setVersion] = useState("1.0");
  const [streaming, setStreaming] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [authScheme, setAuthScheme] = useState("none");
  const [skillsJson, setSkillsJson] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getMe(), getCard(id)])
      .then(([meData, cardData]) => {
        if (cancelled) return;
        setMe(meData);
        setCard(cardData);
        // Populate form
        setSlug(cardData.slug);
        setDisplayName(cardData.display_name);
        setDescription(cardData.description ?? "");
        setRuntimeUrl(cardData.runtime_url ?? "");
        setProviderName(cardData.provider_name ?? "");
        setProviderUrl(cardData.provider_url ?? "");
        setVersion(cardData.version ?? "1.0");
        setStreaming(cardData.capabilities.streaming ?? false);
        setPushNotifications(cardData.capabilities.pushNotifications ?? false);
        const schemes = cardData.authentication.schemes ?? ["none"];
        setAuthScheme(schemes[0] ?? "none");
        setSkillsJson(cardData.skills.length > 0 ? JSON.stringify(cardData.skills, null, 2) : "");
        setStatus(cardData.status);
        setIsPublic(cardData.is_public);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearAuthToken();
          router.replace("/login");
        } else if (err instanceof ApiError && err.status === 404) {
          router.replace("/dashboard");
        } else {
          setError("Could not load card.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    let skills: unknown[] = [];
    if (skillsJson.trim()) {
      try {
        const parsed = JSON.parse(skillsJson);
        if (!Array.isArray(parsed)) {
          setError("Skills must be a JSON array");
          setSaving(false);
          return;
        }
        skills = parsed;
      } catch {
        setError("Invalid JSON in skills field");
        setSaving(false);
        return;
      }
    }

    try {
      const updated = await updateCard(id, {
        slug,
        display_name:  displayName,
        description:   description || undefined,
        runtime_url:   runtimeUrl || undefined,
        version:       version || "1.0",
        capabilities:  { streaming, pushNotifications },
        authentication: { schemes: [authScheme] },
        skills,
        provider_name: providerName || undefined,
        provider_url:  providerUrl || undefined,
        status,
        is_public:     isPublic,
      });
      setCard(updated);
      setSuccess("Card updated successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update card.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteCard(id);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to delete card.");
      }
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <PageShell title="Edit card" description="Loading…">
        <div className={`${infoCardClass} text-sm text-ink-weak`}>
          Loading…
        </div>
      </PageShell>
    );
  }

  if (!card || !me) {
    return (
      <PageShell title="Edit card" description="">
        <div className="rounded-card border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-4 text-[color:var(--color-danger)]">
          {error ?? "Card not found."}
        </div>
      </PageShell>
    );
  }

  const publicUrl = getPublicUrl(
    me.identity_type,
    me.identity_type === "domain" ? (me.domain ?? me.email) : me.email,
    slug || card.slug,
    me.handle
  );

  return (
    <PageShell
      title={`Edit: ${card.display_name}`}
      description="Update your agent card details."
    >
      <div className="max-w-lg space-y-6">
        {/* Public URL banner */}
        {isPublic ? (
          <div className="rounded-card border border-line-strong bg-brand-200 p-5 shadow-card">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-800">
              Public URL
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-brand-800">
                {publicUrl}
              </code>
              <button
                onClick={() => copyUrl(publicUrl)}
                className="shrink-0 inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-xs font-medium text-ink hover:border-line-strong transition"
              >
                {copiedUrl ? "Copied!" : "Copy"}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center justify-center h-9 rounded-control border-2 border-line bg-surface-light px-3 text-xs font-medium text-ink hover:border-line-strong transition"
              >
                Open
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-[#fdeccc] bg-[#fdeccc] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#8a5a06]">Private</p>
            <p className="mt-1 text-sm text-[#8a5a06]">This card is not publicly accessible. Enable &ldquo;Public&rdquo; below to publish it.</p>
          </div>
        )}

        {/* Edit form */}
        <form onSubmit={onSave} className={`${infoCardClass} space-y-5`}>

          {/* Basic */}
          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Basic info</h2>
            <div className="space-y-4">
              <div>
                <FieldLabel>Slug *</FieldLabel>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required
                  pattern="^[a-z0-9][a-z0-9-]*$"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <FieldLabel>Display name *</FieldLabel>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={textareaClass}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-line" />

          {/* Runtime */}
          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Runtime</h2>
            <div className="space-y-4">
              <div>
                <FieldLabel>Runtime URL</FieldLabel>
                <input
                  type="url"
                  value={runtimeUrl}
                  onChange={(e) => setRuntimeUrl(e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="https://my-agent.example.com"
                />
              </div>
              <div>
                <FieldLabel>Provider name</FieldLabel>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Provider URL</FieldLabel>
                <input
                  type="url"
                  value={providerUrl}
                  onChange={(e) => setProviderUrl(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <FieldLabel>Version</FieldLabel>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className={`${inputClass} w-32 font-mono`}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-line" />

          {/* Capabilities */}
          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Capabilities & Auth</h2>
            <div className="space-y-4">
              <div className="rounded-control border border-line p-4 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-sm text-ink">Public</span>
                    <p className="text-xs text-ink-weak">Accessible at the public URL. Uncheck to make private.</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={streaming}
                    onChange={(e) => setStreaming(e.target.checked)}
                    className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm text-ink">Streaming</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm text-ink">Push notifications</span>
                </label>
              </div>

              <div>
                <FieldLabel>Authentication scheme</FieldLabel>
                <select
                  value={authScheme}
                  onChange={(e) => setAuthScheme(e.target.value)}
                  className={inputClass}
                >
                  <option value="none">None</option>
                  <option value="Bearer">Bearer token</option>
                  <option value="OAuth2">OAuth 2.0</option>
                  <option value="ApiKey">API Key</option>
                </select>
              </div>

              <div>
                <FieldLabel>Skills (JSON array)</FieldLabel>
                <textarea
                  value={skillsJson}
                  onChange={(e) => setSkillsJson(e.target.value)}
                  rows={7}
                  className={`${textareaClass} font-mono text-xs`}
                  placeholder='[{"name": "mySkill", "description": "What it does"}]'
                />
              </div>

              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-control border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-4 py-2.5 text-sm text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-control border border-accent-teal bg-accent-teal px-4 py-2.5 text-sm text-accent-teal-ink">
              {success}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className={secondaryBtnClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={primaryBtnClass}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        {/* Delete zone */}
        <div className="rounded-card border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] p-5">
          <h3 className="text-sm font-semibold text-[color:var(--color-danger)]">Danger zone</h3>
          <p className="mt-1 text-sm text-[color:var(--color-danger)]/85">
            Permanently delete this agent card. This action cannot be undone.
          </p>
          <div className="mt-4">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center h-9 rounded-control border-2 border-[color:var(--color-danger)] bg-surface-light px-3 text-sm font-medium text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)] transition"
              >
                Delete card
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-[color:var(--color-danger)]">Are you sure?</p>
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center h-9 rounded-control bg-[color:var(--color-danger)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 transition"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className={secondaryBtnClass}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
