const LOCAL_HOSTS = new Set(["localhost:3000", "127.0.0.1:3000"]);
const PRODUCTION_ORIGIN = "https://ashnhash-unihunt.hf.space";

function firstHeaderValue(value: string | null): string | null {
  const part = value?.split(",")[0]?.trim();
  return part || null;
}

function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase() ?? "";
}

function isAllowedHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith(".hf.space");
}

function originForHost(host: string, protoHint?: string | null): string | null {
  const normalized = normalizeHost(host);
  if (!isAllowedHost(normalized)) {
    return null;
  }

  const protocol = LOCAL_HOSTS.has(normalized)
    ? protoHint === "https"
      ? "https"
      : "http"
    : "https";
  return `${protocol}://${normalized}`;
}

/**
 * Public browser origin for post-login redirects.
 *
 * Next standalone on Hugging Face binds with `HOSTNAME=0.0.0.0` `PORT=7860`,
 * so `request.url` is `https://0.0.0.0:7860`. Prefer the proxy host, then
 * HF's runtime `SPACE_HOST` (`ashnhash-unihunt.hf.space`).
 */
export function publicAppOrigin(request: Request): string {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const fromForwarded = forwardedHost
    ? originForHost(forwardedHost, forwardedProto)
    : null;
  if (fromForwarded) {
    return fromForwarded;
  }

  const spaceHost = process.env.SPACE_HOST?.trim();
  const fromSpace = spaceHost ? originForHost(spaceHost, "https") : null;
  if (fromSpace) {
    return fromSpace;
  }

  const fromRequest = originForHost(
    new URL(request.url).host,
    new URL(request.url).protocol.replace(":", ""),
  );
  if (fromRequest) {
    return fromRequest;
  }

  return PRODUCTION_ORIGIN;
}

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
