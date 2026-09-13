/**
 * Only same-origin relative paths are allowed after login. Anything else
 * (protocol-relative URLs, external hosts) is treated as `/search`.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/search";
  }
  return value;
}
