/**
 * DuckDuckGo HTML search. Used only to cross-check courses already found via
 * Brave, so a second engine has to agree the university offers that course.
 */

export interface WebHit {
  title: string;
  url: string;
  snippet: string;
}

const SEARCH_URL = "https://html.duckduckgo.com/html/";

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeResultUrl(href: string): string | null {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const url = new URL(absolute, "https://duckduckgo.com");
    const wrapped = url.searchParams.get("uddg");
    if (wrapped) return wrapped;
    if (url.hostname.endsWith("duckduckgo.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseDuckDuckGoHtml(html: string): WebHit[] {
  const hits: WebHit[] = [];
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{ url: string; title: string }> = [];
  for (const match of html.matchAll(linkRe)) {
    const url = decodeResultUrl(match[1]);
    const title = stripTags(match[2]);
    if (url && title) links.push({ url, title });
  }
  const snippets = [...html.matchAll(snippetRe)].map((match) => stripTags(match[1]));
  for (let index = 0; index < links.length && hits.length < 8; index += 1) {
    hits.push({
      title: links[index].title,
      url: links[index].url,
      snippet: snippets[index] ?? "",
    });
  }
  return hits;
}

/** Returns hits, or null when DuckDuckGo does not return a result page. */
export async function duckDuckGoSearch(query: string): Promise<WebHit[] | null> {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
      "User-Agent": "UniHunt/1.0 (university course cross-check)",
    },
    body: new URLSearchParams({ q: query.slice(0, 400), kl: "wt-wt" }),
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (!html.includes("result__a") && /anomaly|captcha|bots use duckduckgo/i.test(html)) {
    return null;
  }
  return parseDuckDuckGoHtml(html);
}
