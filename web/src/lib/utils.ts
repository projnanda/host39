export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * True only for absolute https:// URLs. Guards hrefs/srcs built from
 * third-party data (AgentStatus report/claim/badge URLs) against
 * javascript:, data: and other schemes.
 */
export function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}
