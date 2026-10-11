import { isMajorUniversity } from "./major-universities";
import type { UniversityCourseResult } from "./types";

interface SearchSnippet {
  title: string;
  url: string;
  description: string;
  extraSnippets: string[];
}

const UNDERGRAD_RE =
  /\b(undergraduate|undergrad|\bug\b|bachelor'?s?|b\.?\s?tech|btech|b\.e\.?|b-e\b|bachelor of engineering|first[- ]degree|b\.sc|bsc|b\.a\.|b\.com|bcom|bba|\bbs\b|beng|ll\.?b|mbbs|bpharm)\b/i;
const MASTER_RE =
  /\b(master'?s?|postgraduate|post-?grad|m\.?\s?tech|mtech|m\.sc|msc|mba|m\.eng|ll\.?m|mphil|m\.phil|ms\s+(?:in|of)|pg\s*(?:diploma|program|programme|course)|m\.a\.)\b|\/m(?:sc|s|tech)\//i;
const DOCTORATE_RE = /\b(ph\.?d|dphil|doctorate|doctoral)\b/i;
const DIPLOMA_RE = /\b(diploma|polytechnic)\b/i;
const CERT_RE = /\b(certificate|certification)\b/i;
const ASSOCIATE_RE = /\b(associate)\b/i;
const POSTDOC_RE = /\b(post-?doc(?:toral)?)\b/i;
const INTEGRATED_RE =
  /\b(integrated|dual[\s-]degree|b\.?\s?tech\s*[+/&]\s*m\.?\s?tech)\b/i;

const GENERIC_FEE_RE =
  /^(contact(?: the)? university|see course page|see website|n\/?a|unknown|not (?:specified|listed|available|found)|-|—)?$/i;

const FEE_RE =
  /(?:[₹$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:lakh|lakhs|crore|k|thousand|million))?|\b(?:USD|INR|EUR|GBP|AUD|CAD|SGD)\s*\d[\d,]*(?:\.\d+)?(?:\s?(?:lakh|lakhs|crore))?|\b\d[\d,]*(?:\.\d+)?\s?(?:USD|INR|EUR|GBP|AUD|CAD|SGD|lakh|lakhs|crore)s?\b)/i;

type LevelFamily =
  | "diploma"
  | "certificate"
  | "associate"
  | "undergraduate"
  | "masters"
  | "doctorate"
  | "postdoctoral"
  | "integrated"
  | "unknown";

const KNOWN_CAMPUSES: Array<{ pattern: RegExp; location: string }> = [
  { pattern: /\bbits(?:\s|-)?pilani\b/i, location: "Pilani, Rajasthan, India" },
  { pattern: /\bmanipal\b/i, location: "Manipal, Karnataka, India" },
  {
    pattern: /\bvit\b|vellore institute of technology/i,
    location: "Vellore, Tamil Nadu, India",
  },
  { pattern: /\bsymbiosis\b/i, location: "Pune, Maharashtra, India" },
  { pattern: /\bplaksha\b/i, location: "Mohali, Chandigarh, India" },
  { pattern: /\bashoka university\b/i, location: "Sonipat, Haryana, India" },
  { pattern: /\bkrea university\b/i, location: "Sri City, Andhra Pradesh, India" },
  { pattern: /\bflame university\b/i, location: "Pune, Maharashtra, India" },
  {
    pattern: /\bshiv nadar\b/i,
    location: "Greater Noida, Uttar Pradesh, India",
  },
  { pattern: /\biiit[- ]?delhi\b/i, location: "New Delhi, Delhi, India" },
  { pattern: /\biiit[- ]?hyderabad\b/i, location: "Hyderabad, Telangana, India" },
  { pattern: /\biisc\b|\bindian institute of science\b/i, location: "Bengaluru, Karnataka, India" },
  { pattern: /\biit[- ]?bombay\b|\biit[- ]?mumbai\b/i, location: "Mumbai, Maharashtra, India" },
  { pattern: /\biit[- ]?delhi\b/i, location: "New Delhi, Delhi, India" },
  { pattern: /\biit[- ]?madras\b/i, location: "Chennai, Tamil Nadu, India" },
  { pattern: /\biit[- ]?kanpur\b/i, location: "Kanpur, Uttar Pradesh, India" },
  { pattern: /\biit[- ]?kharagpur\b/i, location: "Kharagpur, West Bengal, India" },
  { pattern: /\biit[- ]?roorkee\b/i, location: "Roorkee, Uttarakhand, India" },
  { pattern: /\biit[- ]?guwahati\b/i, location: "Guwahati, Assam, India" },
  { pattern: /\biit[- ]?hyderabad\b/i, location: "Sangareddy, Telangana, India" },
];

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Chandigarh",
  "Puducherry",
  "Jammu and Kashmir",
  "Ladakh",
];

const CITY_HINTS = [
  "Mohali",
  "Chandigarh",
  "Bengaluru",
  "Bangalore",
  "Mumbai",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Kanpur",
  "Nagpur",
  "Indore",
  "Bhopal",
  "Patna",
  "Kochi",
  "Coimbatore",
  "Mysuru",
  "Mysore",
  "Visakhapatnam",
  "Noida",
  "Gurugram",
  "Gurgaon",
  "Sonipat",
  "Pilani",
  "Kharagpur",
  "Roorkee",
  "Guwahati",
  "Vellore",
  "Manipal",
  "Warangal",
  "Dhanbad",
  "Ropar",
  "Mandi",
  "Jodhpur",
  "Bhubaneswar",
  "Gandhinagar",
  "Sangareddy",
  "Sri City",
  "Greater Noida",
  "New Delhi",
];

export function sourceText(source: SearchSnippet): string {
  return [source.title, source.url, source.description, ...source.extraSnippets]
    .filter(Boolean)
    .join(" ");
}

export function braveLevelQueryParts(level: string): {
  include: string;
  exclude: string;
} {
  switch (level.trim().toLowerCase()) {
    case "undergraduate":
      return { include: "undergraduate B.Tech", exclude: "" };
    case "masters":
      return { include: "masters M.Tech", exclude: "" };
    case "postgraduate":
      return { include: "postgraduate", exclude: "" };
    case "doctorate":
      return { include: "PhD", exclude: "" };
    case "postdoctoral":
      return { include: "postdoctoral", exclude: "" };
    case "diploma":
      return { include: "diploma", exclude: "" };
    case "certificate":
      return { include: "certificate", exclude: "" };
    case "associate":
      return { include: "associate degree", exclude: "" };
    default:
      return { include: level.trim(), exclude: "" };
  }
}

function urlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function inferLevelFromUrl(url: string): LevelFamily {
  const path = urlPathname(url).toLowerCase();
  if (!path || path === "/") return "unknown";
  const undergradPath =
    /\/(ug|undergrad|undergraduate|bachelor|first-degree|firstdegree)|btech|b-tech|b\.tech|b-e-|\/b-e\/|\/be-/.test(
      path
    );
  const masterPath = /\/(mtech|m-tech|msc|mba|masters?|postgraduate|pg)\b/.test(path);
  const doctoratePath = /\/(phd|doctorate|doctoral)\b/.test(path);
  if (undergradPath && !masterPath) return "undergraduate";
  if (doctoratePath && !undergradPath) return "doctorate";
  if (masterPath && !undergradPath) return "masters";
  if (undergradPath) return "undergraduate";
  return "unknown";
}

function inferSourceLevel(source: SearchSnippet): LevelFamily {
  const fromUrl = inferLevelFromUrl(source.url);
  if (fromUrl !== "unknown") return fromUrl;
  return inferLevelFamily(source.title);
}

function inferLevelFamily(text: string): LevelFamily {
  const value = text.trim();
  if (!value) return "unknown";
  if (POSTDOC_RE.test(value)) return "postdoctoral";
  if (INTEGRATED_RE.test(value)) return "integrated";
  const hasDoctorate = DOCTORATE_RE.test(value);
  const hasMaster = MASTER_RE.test(value);
  const hasUndergrad = UNDERGRAD_RE.test(value);
  if (hasMaster && hasUndergrad) return "integrated";
  if (hasDoctorate && !hasUndergrad) return "doctorate";
  if (hasMaster) return "masters";
  if (hasUndergrad) return "undergraduate";
  if (ASSOCIATE_RE.test(value)) return "associate";
  if (DIPLOMA_RE.test(value)) return "diploma";
  if (CERT_RE.test(value)) return "certificate";
  return "unknown";
}

function requestedFamily(level: string): LevelFamily | "any" | "postgraduate" {
  const normalized = level.trim().toLowerCase();
  if (!normalized) return "any";
  if (normalized === "postgraduate") return "postgraduate";
  if (normalized === "masters") return "masters";
  if (normalized === "undergraduate") return "undergraduate";
  if (normalized === "doctorate") return "doctorate";
  if (normalized === "postdoctoral") return "postdoctoral";
  if (normalized === "diploma") return "diploma";
  if (normalized === "certificate") return "certificate";
  if (normalized === "associate") return "associate";
  return "any";
}

function familyCompatible(
  requested: LevelFamily | "any" | "postgraduate",
  inferred: LevelFamily
): boolean {
  if (requested === "any" || inferred === "unknown") return true;
  if (inferred === "integrated") {
    return (
      requested === "undergraduate" ||
      requested === "masters" ||
      requested === "postgraduate"
    );
  }
  if (requested === "postgraduate") {
    return inferred === "masters" || inferred === "doctorate";
  }
  return inferred === requested;
}

export function matchesCourseLevel(requestedLevel: string, ...parts: string[]): boolean {
  return familyCompatible(
    requestedFamily(requestedLevel),
    inferLevelFamily(parts.filter(Boolean).join(" "))
  );
}

export function preferLevelMatchingSources<T extends SearchSnippet>(
  sources: T[],
  courseLevel: string,
  limit: number
): T[] {
  if (!courseLevel.trim()) return sources.slice(0, limit);

  const requested = requestedFamily(courseLevel);
  const matching: T[] = [];
  const unknown: T[] = [];
  const majorMismatch: T[] = [];
  for (const source of sources) {
    const family = inferSourceLevel(source);
    const major = isMajorUniversity(source.title, source.url);
    if (familyCompatible(requested, family)) matching.push(source);
    else if (family === "unknown") unknown.push(source);
    else if (major) majorMismatch.push(source);
  }

  const ordered = [...matching, ...unknown, ...majorMismatch];
  const majors = ordered.filter((source) =>
    isMajorUniversity(source.title, source.url)
  );
  const rest = ordered.filter(
    (source) => !isMajorUniversity(source.title, source.url)
  );
  const majorKeep = Math.min(majors.length, limit);
  return [
    ...majors.slice(0, majorKeep),
    ...rest.slice(0, Math.max(0, limit - majorKeep)),
  ];
}

function knownCampusLocation(universityName: string): string | null {
  for (const { pattern, location } of KNOWN_CAMPUSES) {
    if (pattern.test(universityName)) return location;
  }
  return null;
}

function extractLocation(text: string, country: string): string | null {
  const located = text.match(
    /(?:located|based|campus(?:es)?|university)\s+(?:in|at)\s+([A-Z][A-Za-z][A-Za-z .'-]{2,40}?)(?:[.,;]|$)/
  );
  if (located?.[1]) {
    return ensureCountry(located[1].trim().replace(/\s+/g, " "), country);
  }

  for (const state of INDIAN_STATES) {
    const stateMatch = text.match(
      new RegExp(
        `\\b([A-Z][A-Za-z][A-Za-z .'-]{2,24}),\\s*${state}\\b`,
        "i"
      )
    );
    if (stateMatch?.[1]) {
      return ensureCountry(`${stateMatch[1].trim()}, ${state}`, country);
    }
    if (new RegExp(`\\b${state}\\b`, "i").test(text) && country.toLowerCase() === "india") {
      const city = CITY_HINTS.find((name) =>
        new RegExp(`\\b${name}\\b`, "i").test(text)
      );
      if (city) return `${city}, ${state}, India`;
    }
  }

  const city = CITY_HINTS.find((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
  if (city) return ensureCountry(city, country);

  return null;
}

function ensureCountry(location: string, country: string): string {
  if (!country) return location;
  if (location.toLowerCase().includes(country.toLowerCase())) return location;
  return `${location}, ${country}`;
}

export function resolveUniversityLocation(
  universityName: string,
  modelLocation: string,
  country: string,
  sources: SearchSnippet[]
): string {
  const known = knownCampusLocation(universityName);
  if (known) return known;

  const nameTokens = universityName
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 3);
  const related = sources.filter((source) => {
    const haystack = sourceText(source).toLowerCase();
    return nameTokens.some((token) => haystack.includes(token));
  });
  const haystack = (related.length ? related : sources).map(sourceText).join(" ");
  const extracted = extractLocation(haystack, country);
  if (extracted) return extracted;

  const cleaned = modelLocation.trim();
  if (cleaned) return ensureCountry(cleaned, country);
  return country;
}

function candidateTypeLabel(candidateType: string): string {
  switch (candidateType.trim()) {
    case "in-state":
      return "in-state / domestic local";
    case "out-of-state":
      return "out-of-state / domestic non-local";
    case "out-of-country":
      return "international / out-of-country";
    default:
      return "selected candidate type";
  }
}

function extractTuition(text: string): string | null {
  const match = text.match(FEE_RE);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

export function resolveTuitionFee(
  modelFee: string,
  candidateType: string,
  sources: SearchSnippet[]
): string {
  const cleaned = modelFee.trim();
  if (cleaned && !GENERIC_FEE_RE.test(cleaned)) return cleaned;

  const fromSource = sources.map(sourceText).map(extractTuition).find(Boolean);
  if (fromSource) {
    return `${fromSource} (published fee; ${candidateTypeLabel(candidateType)} rate not listed)`;
  }

  return "Published course fee not listed in search snippets — see the course page";
}

export function formatAdmissionRequirements(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\s*[•·]\s*/g, "\n")
    .replace(/\s*;\s*/g, "\n")
    .replace(/\s*\|\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function resultMatchesCourseLevel(
  result: Pick<
    UniversityCourseResult,
    "courseName" | "courseUrl" | "specialization" | "courseLevel"
  >,
  requestedLevel: string
): boolean {
  const requested = requestedFamily(requestedLevel);
  const fromUrl = inferLevelFromUrl(result.courseUrl);
  if (fromUrl !== "unknown") return familyCompatible(requested, fromUrl);

  const fromName = inferLevelFamily(result.courseName);
  if (fromName !== "unknown") return familyCompatible(requested, fromName);
  return true;
}

function rewriteMislabelledCourseName(
  courseName: string,
  requestedLevel: string,
  sourceFamily: LevelFamily
): string {
  if (
    requestedFamily(requestedLevel) !== "undergraduate" ||
    sourceFamily !== "undergraduate"
  ) {
    return courseName;
  }
  if (inferLevelFamily(courseName) !== "masters") return courseName;
  return courseName
    .replace(/\bM\.?\s*Tech\b/gi, "B.Tech")
    .replace(/\bMaster(?:'?s)?(?:\s+of|\s+in)?\b/gi, "Bachelor's")
    .replace(/\bMBA\b/g, "Bachelor's");
}

export function filterResultsByCourseLevel(
  results: UniversityCourseResult[],
  courseLevel: string
): UniversityCourseResult[] {
  if (!courseLevel.trim()) return results;
  return results.filter((result) => resultMatchesCourseLevel(result, courseLevel));
}

export function enrichCourseResult(
  result: UniversityCourseResult,
  criteria: { courseLevel: string; candidateType: string; countries: string[] },
  sources: SearchSnippet[]
): UniversityCourseResult {
  const country = result.country.trim() || criteria.countries[0] || "";
  const matchedSource = sources.find((source) => {
    if (!result.courseUrl) return false;
    return (
      source.url === result.courseUrl ||
      source.url.replace(/\/$/, "") === result.courseUrl.replace(/\/$/, "")
    );
  });
  const sourceFamily = matchedSource
    ? inferSourceLevel(matchedSource)
    : inferLevelFromUrl(result.courseUrl);
  const courseName = rewriteMislabelledCourseName(
    result.courseName,
    criteria.courseLevel,
    sourceFamily
  );

  return {
    ...result,
    courseName,
    country,
    courseLevel: criteria.courseLevel.trim() || result.courseLevel.trim(),
    universityLocation: resolveUniversityLocation(
      result.universityName,
      result.universityLocation,
      country,
      sources
    ),
    tuitionFee: resolveTuitionFee(result.tuitionFee, criteria.candidateType, sources),
    admissionRequirements: formatAdmissionRequirements(result.admissionRequirements),
  };
}
