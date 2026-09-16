/**
 * Course URLs originate from Brave Search, model output, and manual user entry,
 * and are rendered straight into an anchor `href`. Restricting them to http(s)
 * keeps `javascript:` and `data:` URLs from becoming a click-to-execute vector.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns the URL when it is a usable http(s) link, or an empty string. */
export function safeHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && isHttpUrl(trimmed) ? trimmed : "";
}
