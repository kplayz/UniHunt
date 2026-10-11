import {
  braveLevelQueryParts,
  preferLevelMatchingSources,
} from "./course-match";
import { seedCourseSources } from "./known-programmes";
import {
  majorUniversityQueryTerms,
  majorUniversityScore,
  prioritizeMajorUniversitySources,
} from "./major-universities";
import { specializationMatchScore } from "./ranking";
import type { SearchCriteriaInput } from "./types";
import { isHttpUrl, safeHttpUrl } from "./url";

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const QUERY_LIMIT = 400;
const MAX_SOURCES = 16;
const MAX_TARGETED_LOOKUPS = 3;
const SNIPPET_LIMIT = 320;
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
  "collegedekho.com",
  "collegedunia.com",
  "careers360.com",
  "collegepravesh.com",
  "getmyuni.com",
  "cwur.org",
  "distancelearningportal.com",
  "edurank.org",
  "edudisha.com",
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
  "jagranjosh.com",
  "keystoneacademic.com",
  "kollegeapply.com",
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
  "universitykart.com",
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

/**
 * Brave Web Search only accepts this country enum. Sending any other code
 * (IE, SG, AE, …) returns HTTP 422.
 */
const BRAVE_COUNTRY_ENUM = new Set([
  "ALL",
  "AR",
  "AT",
  "AU",
  "BE",
  "BR",
  "CA",
  "CH",
  "CL",
  "CN",
  "DE",
  "DK",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HK",
  "ID",
  "IN",
  "IT",
  "JP",
  "KR",
  "MX",
  "MY",
  "NL",
  "NO",
  "NZ",
  "PH",
  "PL",
  "PT",
  "RU",
  "SA",
  "SE",
  "TR",
  "TW",
  "US",
  "ZA",
]);

/** Brave `country` codes for common study destinations. */
export const BRAVE_COUNTRY_CODES: Record<string, string> = {
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Belgium: "BE",
  Brazil: "BR",
  Canada: "CA",
  Chile: "CL",
  China: "CN",
  Denmark: "DK",
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  Greece: "GR",
  "Hong Kong": "HK",
  India: "IN",
  Indonesia: "ID",
  Italy: "IT",
  Japan: "JP",
  Malaysia: "MY",
  Mexico: "MX",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Philippines: "PH",
  Poland: "PL",
  Portugal: "PT",
  "Saudi Arabia": "SA",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Taiwan: "TW",
  Turkey: "TR",
  "United Kingdom": "GB",
  "United States": "US",
};

let nextRequestAt = 0;

export function getBraveApiKey(): string | undefined {
  const raw = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
  if (!raw) return undefined;
  return raw.trim().replace(/^["']|["']$/g, "") || undefined;
}

function braveCountryParam(country?: string): string | undefined {
  if (!country) return undefined;
  const code = BRAVE_COUNTRY_CODES[country] ?? country.toUpperCase();
  return BRAVE_COUNTRY_ENUM.has(code) ? code : undefined;
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

export function registrableHost(url: string): string | null {
  const host = hostnameOf(url);
  if (!host) return null;
  const parts = host.split(".");
  if (
    parts.length >= 3 &&
    parts[parts.length - 1] === "in" &&
    ["ac", "edu", "gov", "co", "res", "ernet"].includes(parts[parts.length - 2])
  ) {
    return parts.slice(-3).join(".");
  }
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return host;
}

export function isAggregatorUrl(url: string): boolean {
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
  const { include, exclude } = braveLevelQueryParts(criteria.courseLevel);
  const subject = subjectPhrase(criteria);
  const country = criteria.countries.find(Boolean) ?? "";
  const countryCode = country ? braveCountryParam(country) : undefined;
  const queries: Array<{ query: string; country?: string }> = [
    {
      query: clipQuery(
        [
          include || criteria.courseLevel.trim(),
          subject,
          country,
          "university course tuition admission",
          exclude,
        ]
          .filter(Boolean)
          .join(" ")
      ),
      country: countryCode,
    },
  ];

  if (subject && subject !== "degree") {
    queries.push({
      query: clipQuery(
        [
          `"${subject}"`,
          include || criteria.courseLevel.trim(),
          majorUniversityQueryTerms(country),
          country,
          "university",
        ]
          .filter(Boolean)
          .join(" ")
      ),
      country: countryCode,
    });
  }

  return queries;
}

function parseRateLimitReset(header: string | null): number {
  if (!header) return 1;
  const first = header.split(",")[0]?.trim();
  const seconds = Number(first);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
}

interface BraveErrorBody {
  error?: {
    code?: string;
    detail?: string;
    status?: number;
  };
}

function describeBraveFailure(status: number, body: unknown): string {
  const error =
    body && typeof body === "object" && "error" in body
      ? (body as BraveErrorBody).error
      : undefined;
  const code = error?.code;
  const detail = error?.detail;

  if (
    status === 401 ||
    status === 403 ||
    code === "SUBSCRIPTION_TOKEN_INVALID"
  ) {
    return "Brave Search API key is invalid or is not enabled for Web Search. Create a Web Search key in the Brave API dashboard.";
  }

  if (status === 422 || code === "VALIDATION") {
    return detail
      ? `Brave Search rejected the query: ${detail}`
      : "Brave Search rejected the request (invalid parameters).";
  }

  return detail
    ? `Brave Search failed (${status}): ${detail}`
    : `Brave Search failed (${status}).`;
}

async function readBraveErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function braveWebSearch(
  query: string,
  country?: string
): Promise<BraveWebResult[]> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error(
      "BRAVE_SEARCH_API_KEY is not configured. Add a Brave Search API key to return verified course page URLs."
    );
  }

  const countryCode = braveCountryParam(country);
  const attempts: Array<{ country?: string }> = [{ country: countryCode }];
  if (countryCode) attempts.push({ country: undefined });

  let lastError = "Brave Search failed.";
  for (const attempt of attempts) {
    const params = new URLSearchParams({
      q: query,
      count: "20",
    });
    if (attempt.country) params.set("country", attempt.country);

    await throttleBraveRequests();

    const response = await fetch(`${BRAVE_WEB_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429) {
      const waitSec = parseRateLimitReset(
        response.headers.get("x-ratelimit-reset")
      );
      lastError = "Brave Search rate limit exceeded. Please try again shortly.";
      await sleep(waitSec * 1000 + 150);
      continue;
    }

    if (!response.ok) {
      const body = await readBraveErrorBody(response);
      console.error("Brave Search error:", response.status, body);
      lastError = describeBraveFailure(response.status, body);
      const code =
        body && typeof body === "object" && "error" in body
          ? (body as BraveErrorBody).error?.code
          : undefined;
      if (
        response.status === 401 ||
        response.status === 403 ||
        code === "SUBSCRIPTION_TOKEN_INVALID"
      ) {
        throw new Error(lastError);
      }
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

const PROMOTIONAL_NAME_RE =
  /\b(best|top|#\s*1|no\.?\s*1|leading|ranked?|ranking|apply now|admission\s*20\d{2}|colleges?\s+in\s+|universities\s+in\s+|world[- ]class|most\s+popular|highest\s+placement)\b/i;

const INSTITUTION_NAME_RE =
  /\b(university|universiti|universidad|universität|institute|college|vidyapeetham|vidyapeeth|polytechnic|hochschule|schule|école|iit|iiit|nit|bits)\b/i;

export function isPromotionalUniversityName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (PROMOTIONAL_NAME_RE.test(trimmed)) return true;
  if (/^\s*(best|top)\b/i.test(trimmed)) return true;
  return trimmed.split(/\s+/).length > 10 && INSTITUTION_NAME_RE.test(trimmed);
}

function looksLikeUniversityName(value: string): boolean {
  if (isPromotionalUniversityName(value)) return false;
  return INSTITUTION_NAME_RE.test(value);
}

function formatHostToken(token: string): string {
  if (token.length <= 4) return token.toUpperCase();
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function nameFromRegistrableHost(url: string): string {
  const root = registrableHost(url);
  if (!root) return "";
  const slug = root.split(".")[0]?.toLowerCase() ?? "";
  if (
    !slug ||
    slug.length <= 2 ||
    ["online", "admission", "admissions", "course", "courses", "www"].includes(
      slug
    )
  ) {
    return "";
  }

  const pretty = slug
    .replace(/university$/i, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map(formatHostToken)
    .join(" ")
    .trim();
  if (!pretty) return "";
  if (
    /\b(university|institute|college|iit|iiit|nit|bits|vit|mit|iisc)\b/i.test(
      pretty
    ) ||
    /^[A-Z]{2,6}(?:\s+[A-Za-z]+)*$/.test(pretty)
  ) {
    return pretty;
  }
  return `${pretty} University`;
}

function findOfficialNameInText(text: string): string | null {
  const cleaned = text.replace(
    /\b(?:choose|does|visit|explore|apply|welcome to|welcome|about|find|discover|search|compare|join|why|how|what)\s+/gi,
    " "
  );
  const pattern =
    /\b([A-Z][A-Za-z'.]+(?:\s+(?:of|and|&|the|for|[A-Z][A-Za-z'.]+)){0,6})\s+(University|Universiti|Universität|Universidad|Institute(?:\s+of\s+(?:Technology|Science|Engineering|Information\s+Technology))?|Vidyapeetham|Vidyapeeth|Hochschule|Polytechnic)\b/g;
  const matches: string[] = [];
  for (const match of cleaned.matchAll(pattern)) {
    const name = match[0].replace(/\s+/g, " ").trim();
    if (isPromotionalUniversityName(name)) continue;
    const words = name.split(/\s+/);
    if (words.length < 2 || words.length > 8) continue;
    const first = words[0].replace(/[^A-Za-z]/g, "");
    if (
      /^(The|A|An|Best|Top|Choose|Does|Visit|Explore|Apply|Welcome|About|Find|Discover|Search|Compare|Join|Why|How|What)$/i.test(
        first
      )
    ) {
      continue;
    }
    matches.push(name);
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}

function nameAgreesWithHost(official: string, url: string): boolean {
  const hostSlug = (registrableHost(url)?.split(".")[0] ?? "").toLowerCase();
  if (!hostSlug) return true;
  const officialLower = official.toLowerCase();
  const hostCompact = hostSlug.replace(/[-_]/g, "");
  const officialCompact = officialLower.replace(/[^a-z0-9]/g, "");
  if (
    officialLower.includes(hostSlug.replace(/[-_]/g, " ")) ||
    officialCompact.includes(hostCompact) ||
    hostCompact.includes(officialCompact)
  ) {
    return true;
  }
  const initials = official
    .split(/\s+/)
    .filter((word) => !/^(of|and|the|&|for|university|institute|college)$/i.test(word))
    .map((word) => word[0] ?? "")
    .join("")
    .toLowerCase();
  if (
    initials &&
    (hostSlug === initials ||
      hostCompact === initials ||
      hostCompact.startsWith(initials) ||
      initials.startsWith(hostCompact))
  ) {
    return true;
  }
  const hostParts = hostSlug.split(/[-_]/).filter((part) => part.length > 2);
  if (hostParts.length > 1 && hostParts.every((part) => officialLower.includes(part))) {
    return true;
  }
  return hostSlug.length > 4;
}

export function universityNameFromSource(source: BraveWebResult): string {
  const chunks = [
    ...source.title.split(/\s[|\-–—]\s/),
    source.description,
    ...source.extraSnippets,
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  const fromText = chunks
    .map(findOfficialNameInText)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => b.length - a.length)[0];
  const fromHost = nameFromRegistrableHost(source.url);
  if (fromText && nameAgreesWithHost(fromText, source.url)) return fromText;

  const titleParts = source.title
    .split(/\s[|\-–—]\s/)
    .map((part) => part.trim())
    .filter(Boolean);
  const named = titleParts.find(looksLikeUniversityName);
  if (named && nameAgreesWithHost(named, source.url)) return named;

  if (fromHost) return fromHost;
  if (fromText) return fromText;

  const fallback = titleParts[titleParts.length - 1] ?? source.title;
  if (isPromotionalUniversityName(fallback)) {
    return fromHost || fallback;
  }
  return fallback;
}

export function courseNameFromSource(
  source: BraveWebResult,
  fallback: string
): string {
  const titleParts = source.title
    .split(/\s[|\-–—]\s/)
    .map((part) => part.trim())
    .filter(Boolean);
  const first = titleParts[0] ?? "";
  if (
    first &&
    !isPromotionalUniversityName(first) &&
    !looksLikeUniversityName(first)
  ) {
    return first;
  }

  try {
    const slug = new URL(source.url).pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/\.(html?|php|aspx)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (slug && slug.length > 3 && !/^(home|index|programmes?-offered)$/i.test(slug)) {
      return slug.replace(/\b\w/g, (char) => char.toUpperCase());
    }
  } catch {
    /* ignore invalid URLs */
  }

  return fallback || first || source.title;
}

function sourceQuality(result: BraveWebResult, subject: string): number {
  let score = 0;
  if (isOfficialLookingUrl(result.url)) score += 5;
  if (!isAggregatorUrl(result.url)) score += 2;
  const haystack = `${result.title} ${result.url} ${result.description}`;
  if (/course|program|programme|degree|study|tuition|admission/i.test(haystack)) {
    score += 3;
  }
  score += specializationMatchScore(haystack, subject) * 6;
  score += majorUniversityScore(result.title, result.url);
  return score;
}

function diversifyByHost(results: BraveWebResult[]): BraveWebResult[] {
  const uniqueHost: BraveWebResult[] = [];
  const rest: BraveWebResult[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const host = registrableHost(result.url) ?? hostnameOf(result.url);
    if (host && !seen.has(host)) {
      seen.add(host);
      uniqueHost.push(result);
    } else {
      rest.push(result);
    }
  }
  return uniqueHost;
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
  const seeds = seedCourseSources(criteria);
  const collected: BraveWebResult[] = [...seeds];

  for (const { query, country } of queries) {
    const page = await braveWebSearch(query, country);
    collected.push(...page);
  }

  const unique = dedupeSources(collected);
  const preferred = unique.filter((result) => !isAggregatorUrl(result.url));
  const subject = subjectPhrase(criteria);
  const ranked = (preferred.length >= 6 ? preferred : unique)
    .slice()
    .sort((a, b) => sourceQuality(b, subject) - sourceQuality(a, subject));
  const diversified = diversifyByHost(ranked);
  const selected = preferLevelMatchingSources(
    diversified,
    criteria.courseLevel,
    Math.max(MAX_SOURCES, diversified.length)
  );
  const selectedHosts = new Set(
    selected.map((source) => registrableHost(source.url)).filter(Boolean)
  );
  const missingSeeds = seeds.filter((seed) => {
    const host = registrableHost(seed.url);
    return host ? !selectedHosts.has(host) : true;
  });
  const withSeeds = prioritizeMajorUniversitySources(
    [...missingSeeds, ...selected],
    MAX_SOURCES
  );
  console.info(
    "Brave course sources:",
    withSeeds.map((source) => `${universityNameFromSource(source)} <${source.url}>`).join(" | ")
  );
  return withSeeds;
}

export function formatSourcesForPrompt(sources: BraveWebResult[]): string {
  return sources
    .map((source, index) => {
      const snippet = [source.description, ...source.extraSnippets]
        .filter(Boolean)
        .join(" ")
        .slice(0, SNIPPET_LIMIT)
        .trim();
      const university = universityNameFromSource(source);
      return `[${index + 1}] ${source.title}
University: ${university}
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
