import {
  BRAVE_COUNTRY_CODES,
  braveWebSearch,
  isAggregatorUrl,
  registrableHost,
  type BraveWebResult,
} from "./brave";
import {
  completeWithFallback,
  createInferenceClient,
  extractJsonArray,
} from "./huggingface";
import { importantDateCategoryLabel } from "./important-dates-format";
import type {
  ImportantDate,
  ImportantDateCategory,
  ImportantDatesReport,
} from "./types";
import { isHttpUrl, safeHttpUrl } from "./url";

export interface ImportantDatesTarget {
  universityName: string;
  courseName: string;
  courseUrl: string | null;
  country: string | null;
  courseLevel: string | null;
}

const MAX_PAGES_TO_FETCH = 6;
const PAGE_FETCH_TIMEOUT_MS = 10_000;
const PAGE_MAX_BYTES = 600_000;
const PAGE_EVIDENCE_CHARS = 2_800;
const TOTAL_EVIDENCE_CHARS = 14_000;
const MAX_DATES = 30;

const CATEGORIES: ImportantDateCategory[] = [
  "application_open",
  "application_deadline",
  "entrance_exam",
  "scholarship",
  "offer_or_result",
  "fee_payment",
  "session_start",
  "orientation",
  "other",
];

const CATEGORY_ORDER = new Map(CATEGORIES.map((category, index) => [category, index]));

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Any date-looking token, with or without a year. */
const DATE_RE = new RegExp(
  `(?:\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?(?:\\s*20\\d{2})?\\b` +
    `|\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?(?:\\s*20\\d{2})?\\b` +
    `|\\b${MONTH}\\.?,?\\s+20\\d{2}\\b` +
    `|\\b\\d{1,2}([/.-])\\d{1,2}\\1(?:20\\d{2}|\\d{2})\\b` +
    `|\\b20\\d{2}-\\d{2}-\\d{2}\\b)`,
  "gi"
);

const DATE_KEYWORD_RE =
  /\b(deadline|last date|closing|closes?|open(?:s|ing)?|start(?:s|ing)?|begin(?:s|ning)?|commenc\w+|apply|application|admission|registration|register|scholarship|fellowship|financial aid|fee|tuition|orientation|induction|session|semester|term|intake|result|interview|exam|test|counsel\w*|offer|enrol\w*|round|phase|window|important dates|key dates|calendar|reporting|classes)\b/i;

type LevelKey = "undergraduate" | "postgraduate" | "doctorate";

/** Programme-level words. A line about another level is noise for this course. */
const LEVEL_KEYWORDS: Record<LevelKey, RegExp> = {
  undergraduate:
    /\b(undergraduate|ug|bachelor'?s?|b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|b\.?a\.?|bba|bcom|first[- ]degree|bitsat|jee|a-levels?|ib diploma|class (?:xii|12)|12th)\b/i,
  postgraduate:
    /\b(postgraduate|pg|master'?s?|m\.?\s?tech|m\.?\s?sc|m\.?\s?e\.?|mba|m\.?a\.?|higher[- ]degree|gate|gre|gmat)\b/i,
  doctorate: /\b(ph\.?\s?d|doctoral|doctorate|dphil|research scholar|fellowship)\b/i,
};

function requestedLevel(courseLevel: string | null): LevelKey | null {
  const level = (courseLevel ?? "").trim().toLowerCase();
  if (level === "undergraduate" || level === "associate" || level === "diploma") return "undergraduate";
  if (level === "masters" || level === "postgraduate") return "postgraduate";
  if (level === "doctorate" || level === "postdoctoral") return "doctorate";
  return null;
}

function mentionsOtherLevelOnly(text: string, level: LevelKey | null): boolean {
  if (!level) return false;
  if (LEVEL_KEYWORDS[level].test(text)) return false;
  return (Object.keys(LEVEL_KEYWORDS) as LevelKey[]).some(
    (other) => other !== level && LEVEL_KEYWORDS[other].test(text)
  );
}

const EMOJI_RE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

const CATEGORY_HINTS: Array<{ category: ImportantDateCategory; pattern: RegExp }> = [
  { category: "scholarship", pattern: /scholarship|fellowship|financial aid|bursary|merit award/i },
  {
    category: "application_deadline",
    pattern: /deadline|last date|closing|closes?\b|due\b|end(?:s)? on|final date|till\b|until\b/i,
  },
  {
    category: "application_open",
    pattern: /application(?:s)? (?:open|start|begin|portal)|registration (?:open|start|begin)|opens?\b|start(?:s)? on|commencement of (?:application|registration)/i,
  },
  { category: "entrance_exam", pattern: /\b(exam|test|bitsat|jee|sat|act|gre|gmat|ielts|toefl|interview|aptitude|slot booking)\b/i },
  { category: "offer_or_result", pattern: /result|merit list|offer|admission list|shortlist|announce|selection/i },
  { category: "fee_payment", pattern: /fee payment|pay(?:ment)? of fee|deposit|acceptance fee|tuition (?:due|payment)/i },
  { category: "orientation", pattern: /orientation|induction|welcome week|reporting/i },
  {
    category: "session_start",
    pattern: /session (?:start|begin|commenc)|semester (?:start|begin|commenc)|classes (?:start|begin|commenc)|commencement of (?:classes|session|semester)|term (?:start|begin)|academic year (?:start|begin)|first day of class/i,
  },
];

// ---------------------------------------------------------------------------
// Host discovery
// ---------------------------------------------------------------------------

function isOfficialHost(host: string): boolean {
  return (
    host.endsWith(".edu") ||
    host.includes(".edu.") ||
    host.includes(".ac.") ||
    host.endsWith(".ac") ||
    /\buni(?:v|versit)/.test(host)
  );
}

function hostFromCourseUrl(courseUrl: string | null): string | null {
  if (!courseUrl || !isHttpUrl(courseUrl) || isAggregatorUrl(courseUrl)) return null;
  return registrableHost(courseUrl);
}

async function discoverUniversityHost(
  target: ImportantDatesTarget,
  countryCode?: string
): Promise<string | null> {
  const query = `"${target.universityName}" ${target.country ?? ""} official website admissions`;
  const results = await braveWebSearch(query, countryCode);
  const candidates = results.filter((result) => !isAggregatorUrl(result.url));
  const official = candidates.find((result) => {
    const host = registrableHost(result.url);
    return host ? isOfficialHost(host) : false;
  });
  const chosen = official ?? candidates[0];
  return chosen ? registrableHost(chosen.url) : null;
}

// ---------------------------------------------------------------------------
// Brave queries
// ---------------------------------------------------------------------------

function shortCourseName(courseName: string): string {
  return courseName
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(b\.?\s?tech|b\.?e\.?|m\.?\s?tech|bachelor(?:'s)?|master(?:'s)?|of|in|programme|program|course|degree)\b/gi, " ")
    .replace(/[^a-z0-9&\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

function buildQueries(host: string, target: ImportantDatesTarget): string[] {
  const year = new Date().getFullYear();
  const nextYear = year + 1;
  const level = target.courseLevel?.trim().toLowerCase() ?? "";
  const levelWord =
    level === "undergraduate"
      ? "undergraduate"
      : level === "masters" || level === "postgraduate"
        ? "postgraduate"
        : level === "doctorate"
          ? "PhD"
          : "";
  const course = shortCourseName(target.courseName);

  return [
    `site:${host} ${levelWord} admissions important dates application deadline ${year} ${nextYear}`,
    `site:${host} ${course} ${levelWord} application dates`,
    `site:${host} scholarship application last date ${year} ${nextYear}`,
    `site:${host} academic calendar session commencement orientation ${year} ${nextYear}`,
  ].map((query) => query.replace(/\s+/g, " ").trim());
}

function pageRelevance(result: BraveWebResult): number {
  const text = `${result.title} ${result.url} ${result.description} ${result.extraSnippets.join(" ")}`;
  let score = 0;
  const dates = text.match(DATE_RE)?.length ?? 0;
  score += Math.min(dates, 8) * 2;
  if (/important dates|key dates|deadline|academic calendar|admission schedule/i.test(text)) score += 6;
  if (/admission|apply|application|scholarship|calendar/i.test(result.url)) score += 3;
  if (/\.(pdf)(\?|$)/i.test(result.url)) score -= 2;
  if (/news|blog|event|alumni|faculty|research|login/i.test(result.url)) score -= 3;
  return score;
}

// ---------------------------------------------------------------------------
// Page fetching (SSRF-guarded)
// ---------------------------------------------------------------------------

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }
  // IPv6 literal (URL hostname keeps the brackets)
  if (host.startsWith("[") || host.includes(":")) return true;
  // Any IPv4 literal: university pages are never served from bare IPs.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}

function isSafeRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code);
      return Number.isFinite(num) && num > 31 && num < 0x10ffff ? String.fromCodePoint(num) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const num = parseInt(hex, 16);
      return Number.isFinite(num) && num > 31 && num < 0x10ffff ? String.fromCodePoint(num) : " ";
    });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|table|ul|ol|dt|dd|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function fetchPageText(url: string): Promise<string | null> {
  if (!isSafeRemoteUrl(url)) return null;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "User-Agent":
          "Mozilla/5.0 (compatible; UniversityCourseFinder/1.0; +https://ashnhash-unihunt.hf.space)",
      },
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) return null;
    if (!isSafeRemoteUrl(response.url || url)) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < PAGE_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
      }
    }
    await reader.cancel().catch(() => undefined);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    );
    return /text\/plain/i.test(type) ? html : htmlToText(html);
  } catch (error) {
    console.warn(`Important dates: could not fetch ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Evidence selection
// ---------------------------------------------------------------------------

/** Lines that contain a date-looking token, with their heading context. */
export function dateBearingLines(
  text: string,
  limitChars = PAGE_EVIDENCE_CHARS,
  level: LevelKey | null = null
): string[] {
  const lines = text
    .split(/\n+/)
    .flatMap((line) => (line.length > 400 ? line.split(/(?<=[.;!?])\s+(?=[A-Z])/) : [line]))
    .map((line) => line.replace(EMOJI_RE, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 6 && line.length <= 400);

  const picked: string[] = [];
  const seen = new Set<string>();
  let used = 0;
  let lastHeading = "";

  for (const line of lines) {
    const hasDate = DATE_RE.test(line);
    DATE_RE.lastIndex = 0;
    if (!hasDate) {
      if (line.length <= 90 && DATE_KEYWORD_RE.test(line)) lastHeading = line;
      continue;
    }
    const keyworded = DATE_KEYWORD_RE.test(line) || DATE_KEYWORD_RE.test(lastHeading);
    if (!keyworded) continue;
    const entry = lastHeading && !line.includes(lastHeading) ? `${lastHeading}: ${line}` : line;
    if (mentionsOtherLevelOnly(entry, level)) continue;
    const key = entry.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    if (used + entry.length > limitChars) break;
    picked.push(entry);
    used += entry.length;
  }
  return picked;
}

interface EvidencePage {
  title: string;
  url: string;
  lines: string[];
}

/** Brave descriptions carry inline HTML (`<strong>`), so run them through the same cleaner. */
function snippetLines(result: BraveWebResult, level: LevelKey | null): string[] {
  const text = htmlToText([result.description, ...result.extraSnippets].join("\n"));
  return dateBearingLines(text, 800, level);
}

function pageIsOtherLevel(page: BraveWebResult, level: LevelKey | null): boolean {
  return mentionsOtherLevelOnly(`${page.title} ${decodeURIComponent(page.url)}`, level);
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

function monthIndex(token: string): number {
  const lower = token.toLowerCase().replace(/\./g, "");
  return MONTH_NAMES.findIndex((name) => name.startsWith(lower.slice(0, 3)));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Best-effort conversion of "15 June 2026", "June 15, 2026", "15/06/2026",
 * "2026-06-15" or "15 June" (year inferred as the next occurrence) to ISO.
 */
export function parseDateText(
  text: string,
  options: { country?: string | null; today?: Date } = {}
): string | null {
  const value = text.trim();
  const today = options.today ?? new Date();
  const monthFirstCountries = new Set(["united states", "usa", "philippines"]);
  const monthFirst = monthFirstCountries.has((options.country ?? "").trim().toLowerCase());
  // In a range such as "April 17 – May 2, 2026" the year is written once, at
  // the end; reuse it for the first date instead of guessing from today.
  const sharedYear = value.match(/\b(20\d{2})\b/)?.[1];

  let match = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\.?,?\\s*(\\d{4})?\\b`, "i"));
  if (match) {
    const month = monthIndex(match[2]) + 1;
    return withInferredYear(Number(match[1]), month, match[3] ?? sharedYear, today);
  }

  match = value.match(new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?\\b`, "i"));
  if (match) {
    const month = monthIndex(match[1]) + 1;
    return withInferredYear(Number(match[2]), month, match[3] ?? sharedYear, today);
  }

  match = value.match(/\b(\d{1,2})([/.-])(\d{1,2})\2(20\d{2}|\d{2})\b/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[3]);
    const rawYear = Number(match[4]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const [day, month] = monthFirst || a > 12 ? (a > 12 ? [a, b] : [b, a]) : [a, b];
    return isoDate(year, month, day) ?? isoDate(year, day, month);
  }

  match = value.match(new RegExp(`\\b(${MONTH})\\.?,?\\s+(\\d{4})\\b`, "i"));
  if (match) {
    const month = monthIndex(match[1]) + 1;
    return isoDate(Number(match[2]), month, 1);
  }

  return null;
}

function withInferredYear(day: number, month: number, yearText: string | undefined, today: Date): string | null {
  if (yearText) return isoDate(Number(yearText), month, day);
  const year = today.getUTCFullYear();
  const candidate = isoDate(year, month, day);
  if (!candidate) return null;
  // A date more than ~2 months in the past most likely refers to next year.
  const candidateTime = Date.UTC(year, month - 1, day);
  const cutoff = today.getTime() - 60 * 24 * 3600 * 1000;
  return candidateTime < cutoff ? isoDate(year + 1, month, day) : candidate;
}

function inferCategory(text: string): ImportantDateCategory {
  for (const { category, pattern } of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Model extraction
// ---------------------------------------------------------------------------

function buildPrompt(target: ImportantDatesTarget, pages: EvidencePage[], today: string): string {
  const evidence = pages
    .map((page, index) => `[${index + 1}] ${page.title}\nURL: ${page.url}\n${page.lines.join("\n")}`)
    .join("\n\n");

  return `You extract important dates for a university applicant from excerpts of the university's own website.

Today's date: ${today}
University: ${target.universityName}
Course: ${target.courseName}${target.courseLevel ? ` (${target.courseLevel})` : ""}
Country: ${target.country ?? "unknown"}

Return ONLY a JSON array. No markdown, no commentary. Start with [ and end with ].
Each element must have exactly these fields:
{
  "label": "short human label, e.g. Application deadline (Round 2)",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "dateText": "the date exactly as written in the excerpt",
  "date": "YYYY-MM-DD if the day is known, else null",
  "details": "one sentence of context: which intake/round/programme/scholarship it applies to",
  "sourceUrl": "copied EXACTLY from one of the URL lines below"
}

Rules:
1. Include application opening and closing dates, entrance test / interview dates, scholarship or financial-aid deadlines, offer/result dates, fee payment deadlines, session/semester start, orientation or reporting dates. Prefer dates for the ${target.courseLevel ?? ""} intake that is upcoming relative to today.
2. Only use dates present in the excerpts. Do not invent dates. Skip past academic years when a newer year is present for the same event. Skip dates that only concern a different programme level (e.g. PhD or MBA dates when the course is undergraduate).
3. If the excerpt gives a day and month but no year, infer the year as the next occurrence after today.
4. Deduplicate: one object per event. At most ${MAX_DATES} objects. Return [] if nothing relevant.

Website excerpts:
${evidence}`;
}

function normalizeModelDates(
  raw: unknown[],
  allowedUrls: Set<string>,
  target: ImportantDatesTarget
): ImportantDate[] {
  const dates: ImportantDate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const dateText = String(record.dateText ?? record.date_text ?? "").trim();
    const label = String(record.label ?? "").trim();
    if (!dateText && !label) continue;
    const categoryRaw = String(record.category ?? "").trim() as ImportantDateCategory;
    const category = CATEGORIES.includes(categoryRaw)
      ? categoryRaw
      : inferCategory(`${label} ${record.details ?? ""}`);
    const isoRaw = typeof record.date === "string" ? record.date.trim() : "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(isoRaw)
      ? isoRaw
      : parseDateText(dateText || label, { country: target.country });
    const proposed = safeHttpUrl(record.sourceUrl ?? record.source_url);
    const sourceUrl = allowedUrls.has(proposed) ? proposed : (allowedUrls.values().next().value ?? "");
    dates.push({
      label: label || importantDateCategoryLabel(category),
      category,
      date,
      dateText: dateText || (date ?? ""),
      details: String(record.details ?? "").trim().slice(0, 300),
      sourceUrl,
    });
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Heuristic extraction (fallback when the model is unavailable)
// ---------------------------------------------------------------------------

function cleanLabel(value: string): string {
  return value
    .replace(/^[\s|:•·*\-–—,.;()[\]]+|[\s|:•·*\-–—,.;(]+$/g, "")
    .replace(/\b(?:from|to|till|until|on|by|is|are|will be|date|dated)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits "Applications open: 1 Feb 2027 | Last date: 30 Apr 2027" into one
 * (label, dateText) pair per date, using the text that precedes each date.
 */
function labelledDates(line: string): Array<{ label: string; dateText: string }> {
  const pairs: Array<{ label: string; dateText: string }> = [];
  let cursor = 0;
  let previous = "";
  const heading = line.includes(": ") ? line.slice(0, line.indexOf(": ")) : "";
  for (const match of line.matchAll(DATE_RE)) {
    const index = match.index ?? 0;
    const segment = cleanLabel(line.slice(cursor, index));
    const label = segment.length >= 4 ? segment : previous || cleanLabel(heading);
    pairs.push({ label: label.slice(0, 90), dateText: match[0].trim() });
    previous = label;
    cursor = index + match[0].length;
  }
  return pairs;
}

function heuristicDates(pages: EvidencePage[], target: ImportantDatesTarget): ImportantDate[] {
  const dates: ImportantDate[] = [];
  for (const page of pages) {
    for (const line of page.lines) {
      for (const { label, dateText } of labelledDates(line).slice(0, 4)) {
        const category = inferCategory(`${label} ${line.slice(0, 80)}`);
        dates.push({
          label: label || importantDateCategoryLabel(category),
          category,
          date: parseDateText(dateText, { country: target.country }),
          dateText,
          details: line.slice(0, 220),
          sourceUrl: page.url,
        });
      }
    }
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

const MAX_PAST_DAYS = 365;

/**
 * Removes duplicates and dates older than a year, then orders: upcoming
 * (soonest first), undated, and finally past dates (most recent first) so a
 * site that only lists last cycle still shows the typical timeline.
 */
function dedupeAndSort(dates: ImportantDate[], today = new Date()): ImportantDate[] {
  const todayIso = today.toISOString().slice(0, 10);
  const oldest = new Date(today.getTime() - MAX_PAST_DAYS * 86_400_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  const unique: ImportantDate[] = [];
  for (const date of dates) {
    if (date.date && date.date < oldest) continue;
    const key = `${date.category}|${(date.date ?? date.dateText).toLowerCase()}|${date.label.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(date);
  }
  const byCategory = (a: ImportantDate, b: ImportantDate) =>
    (CATEGORY_ORDER.get(a.category) ?? 99) - (CATEGORY_ORDER.get(b.category) ?? 99);
  const upcoming = unique
    .filter((date) => date.date && date.date >= todayIso)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : byCategory(a, b)));
  const undated = unique.filter((date) => !date.date).sort(byCategory);
  const past = unique
    .filter((date) => date.date && date.date < todayIso)
    .sort((a, b) => (a.date! > b.date! ? -1 : a.date! < b.date! ? 1 : byCategory(a, b)));
  return [...upcoming, ...undated, ...past].slice(0, MAX_DATES);
}

function summarize(dates: ImportantDate[], host: string | null, pagesChecked: number): string {
  if (dates.length === 0) {
    return host
      ? `No dated admission information was found on ${host} (${pagesChecked} page${pagesChecked === 1 ? "" : "s"} checked). Open the sources below or the official admissions page directly.`
      : "The university website could not be identified, so no dates were found.";
  }
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = dates.filter((date) => date.date && date.date >= today);
  const deadline = upcoming.find((date) => date.category === "application_deadline");
  const parts = [`${dates.length} date${dates.length === 1 ? "" : "s"} found on ${host ?? "the university website"}`];
  if (deadline) parts.push(`next application deadline ${deadline.dateText}`);
  else if (upcoming[0]) parts.push(`next: ${upcoming[0].label} ${upcoming[0].dateText}`);
  return `${parts.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function findImportantDates(
  target: ImportantDatesTarget
): Promise<ImportantDatesReport> {
  const countryCode = target.country ? BRAVE_COUNTRY_CODES[target.country] : undefined;
  const host = hostFromCourseUrl(target.courseUrl) ?? (await discoverUniversityHost(target, countryCode));
  const checkedAt = new Date().toISOString();

  if (!host) {
    return {
      dates: [],
      sources: [],
      host: null,
      checkedAt,
      summary: summarize([], null, 0),
      method: "heuristic",
    };
  }

  const collected: BraveWebResult[] = [];
  for (const query of buildQueries(host, target)) {
    try {
      collected.push(...(await braveWebSearch(query, countryCode)));
    } catch (error) {
      console.error("Important dates: Brave query failed:", error);
    }
  }

  const byUrl = new Map<string, BraveWebResult>();
  for (const result of collected) {
    if (registrableHost(result.url) !== host) continue;
    const key = result.url.replace(/#.*$/, "").replace(/\/$/, "");
    if (!byUrl.has(key)) byUrl.set(key, result);
  }
  const ranked = [...byUrl.values()].sort((a, b) => pageRelevance(b) - pageRelevance(a));

  const pagesToFetch: BraveWebResult[] = [];
  const courseUrl = safeHttpUrl(target.courseUrl);
  if (courseUrl && registrableHost(courseUrl) === host) {
    pagesToFetch.push({
      title: target.courseName,
      url: courseUrl,
      description: "",
      extraSnippets: [],
    });
  }
  const level = requestedLevel(target.courseLevel);
  for (const result of ranked) {
    if (pagesToFetch.length >= MAX_PAGES_TO_FETCH) break;
    if (pagesToFetch.some((page) => page.url === result.url)) continue;
    if (pageIsOtherLevel(result, level)) continue;
    pagesToFetch.push(result);
  }

  const fetched = await Promise.all(
    pagesToFetch.map(async (page) => {
      const text = await fetchPageText(page.url);
      const lines = text ? dateBearingLines(text, PAGE_EVIDENCE_CHARS, level) : [];
      const fromSnippet = snippetLines(page, level);
      const merged = [...lines];
      for (const line of fromSnippet) {
        if (!merged.includes(line)) merged.push(line);
      }
      return { title: page.title || page.url, url: page.url, lines: merged } satisfies EvidencePage;
    })
  );

  let budget = TOTAL_EVIDENCE_CHARS;
  const pages: EvidencePage[] = [];
  for (const page of fetched) {
    if (page.lines.length === 0) continue;
    const lines: string[] = [];
    for (const line of page.lines) {
      if (budget - line.length < 0) break;
      lines.push(line);
      budget -= line.length;
    }
    if (lines.length > 0) pages.push({ ...page, lines });
  }

  const sources = fetched.map((page) => ({ title: page.title, url: page.url }));
  if (pages.length === 0) {
    return {
      dates: [],
      sources,
      host,
      checkedAt,
      summary: summarize([], host, fetched.length),
      method: "heuristic",
    };
  }

  const allowedUrls = new Set(pages.map((page) => page.url));
  let dates: ImportantDate[] = [];
  let method: ImportantDatesReport["method"] = "heuristic";
  try {
    const { hf, model } = createInferenceClient();
    const content = await completeWithFallback(
      hf,
      buildPrompt(target, pages, checkedAt.slice(0, 10)),
      model
    );
    const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    dates = normalizeModelDates(extractJsonArray(withoutThinking), allowedUrls, target);
    method = "model";
    if (dates.length === 0) {
      console.warn(
        "Important dates: model returned no dates. Preview:",
        withoutThinking.slice(0, 400).replace(/\s+/g, " ")
      );
    }
  } catch (error) {
    console.error("Important dates: model extraction failed, using heuristics:", error);
  }

  if (dates.length === 0) {
    dates = heuristicDates(pages, target);
    method = "heuristic";
  }

  const finalDates = dedupeAndSort(dates);
  return {
    dates: finalDates,
    sources,
    host,
    checkedAt,
    summary: summarize(finalDates, host, fetched.length),
    method,
  };
}
