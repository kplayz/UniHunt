import type { SearchCriteriaInput } from "./types";
import { isHttpUrl, safeHttpUrl } from "./url";

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const QUERY_LIMIT = 400;
const MAX_SOURCES = 12;
const MAX_TARGETED_LOOKUPS = 3;
const SNIPPET_LIMIT = 180;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 20_000;

export interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  extraSnippets: string[];
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string | null;
      extra_snippets?: string[] | null;
    }>;
  };
}

const AGGREGATOR_HOSTS = new Set([
  "4icu.org",
  "academiccourses.com",
  "bachelorstudies.com",
  "bachelorsportal.com",
  "cappex.com",
  "collegeboard.org",
  "collegedunia.com",
  "cwur.org",
  "distancelearningportal.com",
  "edurank.org",
  "educations.com",
  "edvoy.com",
  "findamasters.com",
  "findaphd.com",
  "forbes.com",
  "goabroad.com",
  "healthcarestudies.com",
  "hotcourses.com",
  "hotcoursesabroad.com",
  "idp.com",
  "keystoneacademic.com",
  "lawstudies.com",
  "leverageedu.com",
  "masterstudies.com",
  "mastersportal.com",
  "mbastudies.com",
  "niche.com",
  "onlinestudies.com",
  "petersons.com",
  "phdportal.com",
  "phdstudies.com",
  "princetonreview.com",
  "prospects.ac.uk",
  "qs.com",
  "quora.com",
  "reddit.com",
  "shanghai-ranking.com",
  "shiksha.com",
  "shortcoursesportal.com",
  "studyabroad.com",
  "studylink.com",
  "studyportals.com",
  "thecompleteuniversityguide.co.uk",
  "timeshighereducation.com",
  "topuniversities.com",
  "ucas.com",
  "unigo.com",
  "unipage.net",
  "universityrankings.ch",
  "usnews.com",
  "webometrics.info",
  "whatuni.com",
  "wikipedia.org",
  "yocket.com",
  "youtube.com",
  "youtu.be",
]);

const STOPWORDS = new Set([
  "and",
  "bachelor",
  "bachelors",
  "college",
  "course",
  "degree",
  "for",
  "in",
  "master",
  "masters",
  "msc",
  "of",
  "phd",
  "program",
  "programme",
  "the",
  "university",
]);

/** Brave `country` codes for common study destinations. */
const BRAVE_COUNTRY_CODES: Record<string, string> = {
  Australia: "AU",
  Austria: "AT",
  Belgium: "BE",
  Canada: "CA",
  China: "CN",
  "Czech Republic": "CZ",
  Denmark: "DK",
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  Greece: "GR",
  "Hong Kong": "HK",
  Hungary: "HU",
  India: "IN",
  Ireland: "IE",
  Italy: "IT",
  Japan: "JP",
  Malaysia: "MY",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Poland: "PL",
  Portugal: "PT",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Singapore: "SG",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Turkey: "TR",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
};

let nextRequestAt = 0;

export function getBraveApiKey(): string | undefined {
  return process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleBraveRequests(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + REQUEST_GAP_MS;
  if (wait > 0) await sleep(wait);
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAggregatorUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return true;
  if (AGGREGATOR_HOSTS.has(host)) return true;
  for (const blocked of AGGREGATOR_HOSTS) {
    if (host.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

function isOfficialLookingUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return (
    host.endsWith(".edu") ||
    host.includes(".edu.") ||
    host.includes(".ac.") ||
    host.includes("university") ||
    host.includes("uni-") ||
    /\.uni\./.test(host)
  );
}

export function normalizeSourceUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return value.trim();
  }
}

function clipQuery(query: string): string {
  const collapsed = query.replace(/\s+/g, " ").trim();
  if (collapsed.length <= QUERY_LIMIT) return collapsed;
  return collapsed.slice(0, QUERY_LIMIT).trim();
}

function subjectPhrase(criteria: SearchCriteriaInput): string {
  return (
    criteria.specialization.trim() ||
    criteria.courseType.trim() ||
    "degree"
  );
}

function buildSourceQueries(criteria: SearchCriteriaInput): Array<{
  query: string;
  country?: string;
}> {
  const level = criteria.courseLevel.trim();
  const subject = subjectPhrase(criteria);
  const countries = criteria.countries.filter(Boolean);
  const countryHint = countries.slice(0, 3).join(" ");

  return [
    {
      query: clipQuery(
        [
          level,
          subject,
          countryHint,
          "university official course page tuition admission",
        ]
          .filter(Boolean)
          .join(" ")
      ),
      country:
        countries.length === 1 ? BRAVE_COUNTRY_CODES[countries[0]] : undefined,
    },
  ];
}

function parseRateLimitReset(header: string | null): number {
  if (!header) return 1;
  const first = header.split(",")[0]?.trim();
  const seconds = Number(first);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
}

async function braveWebSearch(
  query: string,
  country?: string
): Promise<BraveWebResult[]> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error(
      "BRAVE_SEARCH_API_KEY is not configured. Add a Brave Search API key to return verified course page URLs."
    );
  }

  const params = new URLSearchParams({
    q: query,
    count: "20",
    extra_snippets: "false",
    result_filter: "web",
    safesearch: "moderate",
    spellcheck: "true",
    text_decorations: "false",
  });
  if (country) params.set("country", country);

  let lastError = "Brave Search failed.";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await throttleBraveRequests();

    const response = await fetch(`${BRAVE_WEB_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429) {
      const waitSec = parseRateLimitReset(response.headers.get("x-ratelimit-reset"));
      lastError = "Brave Search rate limit exceeded. Please try again shortly.";
      await sleep(waitSec * 1000 + 150);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("Brave Search API key is invalid or missing the Web Search product.");
    }

    if (!response.ok) {
      lastError = `Brave Search failed (${response.status}).`;
      continue;
    }

    const data = (await response.json()) as BraveSearchResponse;
    return (data.web?.results ?? [])
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        url: safeHttpUrl(item.url),
        description: String(item.description ?? "").trim(),
        extraSnippets: (item.extra_snippets ?? []).filter(
          (snippet): snippet is string =>
            typeof snippet === "string" && snippet.trim().length > 0
        ),
      }))
      .filter((item) => item.url && isHttpUrl(item.url));
  }

  throw new Error(lastError);
}

function sourceQuality(result: BraveWebResult): number {
  let score = 0;
  if (isOfficialLookingUrl(result.url)) score += 5;
  if (!isAggregatorUrl(result.url)) score += 2;
  const haystack = `${result.title} ${result.url} ${result.description}`;
  if (/course|program|programme|degree|study|tuition|admission/i.test(haystack)) {
    score += 3;
  }
  return score;
}

function dedupeSources(results: BraveWebResult[]): BraveWebResult[] {
  const seen = new Set<string>();
  const unique: BraveWebResult[] = [];
  for (const result of results) {
    const key = normalizeSourceUrl(result.url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
}

export async function searchCourseSources(
  criteria: SearchCriteriaInput
): Promise<BraveWebResult[]> {
  const queries = buildSourceQueries(criteria);
  const collected: BraveWebResult[] = [];

  for (const { query, country } of queries) {
    const page = await braveWebSearch(query, country);
    collected.push(...page);
  }

  const unique = dedupeSources(collected);
  const preferred = unique.filter((result) => !isAggregatorUrl(result.url));
  const ranked = (preferred.length >= 6 ? preferred : unique)
    .slice()
    .sort((a, b) => sourceQuality(b) - sourceQuality(a));

  return ranked.slice(0, MAX_SOURCES);
}

export function formatSourcesForPrompt(sources: BraveWebResult[]): string {
  return sources
    .map((source, index) => {
      const snippet = source.description.slice(0, SNIPPET_LIMIT).trim();
      return `[${index + 1}] ${source.title}
URL: ${source.url}${snippet ? `\n${snippet}` : ""}`;
    })
    .join("\n\n");
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function matchScore(
  source: BraveWebResult,
  universityName: string,
  courseName: string
): number {
  const haystack = `${source.title} ${source.url} ${source.description} ${source.extraSnippets.join(" ")}`.toLowerCase();
  const uniTokens = tokens(universityName);
  const courseTokens = tokens(courseName);
  let score = 0;

  const uniHits = uniTokens.filter((token) => haystack.includes(token)).length;
  const courseHits = courseTokens.filter((token) => haystack.includes(token)).length;

  if (uniTokens.length > 0 && uniHits === uniTokens.length) score += 8;
  else score += uniHits * 2;

  if (courseTokens.length > 0 && courseHits >= Math.ceil(courseTokens.length * 0.5)) {
    score += 6;
  } else {
    score += courseHits;
  }

  if (isOfficialLookingUrl(source.url)) score += 3;
  if (isAggregatorUrl(source.url)) score -= 6;

  return score;
}

function bestMatchingSource(
  universityName: string,
  courseName: string,
  sources: BraveWebResult[],
  minimumScore = 6
): BraveWebResult | null {
  let best: BraveWebResult | null = null;
  let bestScore = 0;
  for (const source of sources) {
    const score = matchScore(source, universityName, courseName);
    if (score > bestScore) {
      best = source;
      bestScore = score;
    }
  }
  return best && bestScore >= minimumScore ? best : null;
}

export function resolveCourseUrl(
  universityName: string,
  courseName: string,
  proposedUrl: string,
  sources: BraveWebResult[]
): string {
  if (sources.length === 0) return "";

  const allowed = new Map(
    sources.map((source) => [normalizeSourceUrl(source.url), source])
  );
  const proposed = safeHttpUrl(proposedUrl);

  if (proposed) {
    const exact = allowed.get(normalizeSourceUrl(proposed));
    if (exact && !isAggregatorUrl(exact.url)) return exact.url;

    const host = hostnameOf(proposed);
    const hostMatches = sources.filter((source) => hostnameOf(source.url) === host);
    if (hostMatches.length === 1 && !isAggregatorUrl(hostMatches[0].url)) {
      return hostMatches[0].url;
    }
    if (hostMatches.length > 1) {
      const bestHost = bestMatchingSource(universityName, courseName, hostMatches, 4);
      if (bestHost) return bestHost.url;
    }
  }

  return bestMatchingSource(universityName, courseName, sources)?.url ?? "";
}

export async function lookupOfficialCourseUrl(
  universityName: string,
  courseName: string,
  country?: string
): Promise<string> {
  const query = clipQuery(
    `"${universityName}" "${courseName}" ${country ?? ""} official university course page`.replace(
      /\s+/g,
      " "
    )
  );
  const countryCode = country ? BRAVE_COUNTRY_CODES[country] : undefined;
  const results = (await braveWebSearch(query, countryCode)).filter(
    (result) => !isAggregatorUrl(result.url)
  );
  return bestMatchingSource(universityName, courseName, results, 5)?.url ?? "";
}

export async function fillMissingCourseUrls<
  T extends { universityName: string; courseName: string; country: string; courseUrl: string },
>(results: T[]): Promise<T[]> {
  const missingIndexes = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => !result.courseUrl)
    .slice(0, MAX_TARGETED_LOOKUPS);

  if (missingIndexes.length === 0) return results;

  const next = results.slice();
  for (const { result, index } of missingIndexes) {
    try {
      const url = await lookupOfficialCourseUrl(
        result.universityName,
        result.courseName,
        result.country
      );
      if (url) next[index] = { ...result, courseUrl: url };
    } catch (error) {
      console.error("Brave targeted URL lookup failed:", error);
    }
  }
  return next;
}
