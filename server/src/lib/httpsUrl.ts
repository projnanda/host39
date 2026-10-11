/**
 * True only for absolute https:// URLs with a host. Used to reject
 * javascript:, data:, http: and other schemes in user-supplied card URLs,
 * which are served publicly and may be rendered as links.
 */
export function isHttpsUrl(value: string): boolean {
  if (value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '';
  } catch {
    return false;
  }
}
