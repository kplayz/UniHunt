import {
  InferenceClient,
  InferenceClientProviderApiError,
} from "@huggingface/inference";
import type { BraveWebResult } from "./brave";
import {
  fillMissingCourseUrls,
  formatSourcesForPrompt,
  resolveCourseUrl,
  searchCourseSources,
  universityNameFromSource,
  registrableHost,
  isPromotionalUniversityName,
  nameFromRegistrableHost,
  courseNameFromSource,
} from "./brave";
import {
  MAX_COMBINED_RESULTS,
  MAX_SEARCH_COUNTRIES,
  tooManyCountriesWarning,
} from "./constants";
import {
  enrichCourseResult,
  filterResultsByCourseLevel,
} from "./course-match";
import { compareRanking, compareSearchResults, specializationMatchScore } from "./ranking";
import {
  majorUniversityScore,
  prioritizeMajorUniversitySources,
} from "./major-universities";
import type {
  CourseSearchOutcome,
  SearchCriteriaInput,
  UniversityCourseResult,
} from "./types";
import { safeHttpUrl } from "./url";

/**
 * Qwen2.5-7B is no longer served by any Inference Provider (HTTP 400
 * model_not_supported), and Qwen3-8B spends its budget on reasoning tokens
 * and returns empty content. These answer in ~1s with clean JSON.
 */
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct";
const FALLBACK_MODELS = [
  "openai/gpt-oss-20b:fastest",
  "Qwen/Qwen2.5-72B-Instruct",
  "meta-llama/Llama-3.1-8B-Instruct",
];
/** Models that are known to be unavailable or unusable; skip when configured. */
const RETIRED_MODELS = new Set([
  "Qwen/Qwen2.5-7B-Instruct",
  "Qwen/Qwen2.5-7B-Instruct:fastest",
  "Qwen/Qwen3-8B",
  "Qwen/Qwen3-8B:nscale",
]);
const MAX_OUTPUT_TOKENS = 4096;
const PRIMARY_TIMEOUT_MS = 25_000;
const FALLBACK_TIMEOUT_MS = 20_000;

function buildSearchPrompt(
  criteria: SearchCriteriaInput,
  sources: BraveWebResult[]
): string {
  const level = criteria.courseLevel.trim() || "Any";
  const candidateType = criteria.candidateType.trim() || "Any";
  return `You extract university courses from search results.

Return ONLY a JSON array. No markdown, no thinking, no explanation. Start with [ and end with ].
Give 6-8 courses from DIFFERENT universities in this country. Use ONLY the Brave Search sources. Copy courseUrl exactly.

Candidate criteria:
- Course Level: ${level}
- Course Type: ${criteria.courseType || "Any"}
- Specialization: ${criteria.specialization || "Any"}
- Preferred Countries: ${criteria.countries.length ? criteria.countries.join(", ") : "Any"}
- Candidate Type: ${candidateType} (in-state = domestic local rate, out-of-state = domestic non-local rate, out-of-country = international rate)
- Last Qualification: ${criteria.lastQualification || "Not specified"}
- Last School/College: ${criteria.lastSchool || "Not specified"}
- Curriculum: ${criteria.curriculum || "Not specified"}
- Subjects/Courses taken: ${criteria.subjects || "Not specified"}
- Grades/GPA/CGPA: ${criteria.grades || "Not specified"}
- Budget restriction (max annual tuition): ${criteria.budgetMax ? `$${criteria.budgetMax} USD equivalent` : "Not specified"}
- Additional notes: ${criteria.additionalNotes || "None"}

HARD RULES:
1. Prefer ${level} programmes. Include a university when its source is a ${level} / B.Tech / bachelor course page, even if that page also mentions PhD or master's options. Skip a result only when the course itself is clearly a master's, MBA, or PhD.
2. Use a different nationally well-known university for each object. Prefer flagship institutions in the country (in India: IIT, NIT, BITS Pilani, VIT, Manipal, Symbiosis, IISc, IIIT). Do not fill the list with little-known private colleges. Include every major-university source that matches the specialization, even if it has no QS ranking.
3. universityName: official institution name only (e.g. Amrita Vishwa Vidyapeetham, BITS Pilani). Never copy marketing headlines such as "Best … College in India". If the title is promotional, take the name from the URL host (amrita.edu → Amrita University) or a non-promotional name in the snippet.
4. universityLocation: copy the campus city from the source title/snippet only. Never invent a state or province. Do not assume Indian tech universities are in Karnataka. If the city is not in the source, use only the country.
5. tuitionFee: prefer the annual fee for candidate type "${candidateType}". If that specific rate is not in the sources, still output whichever published tuition exists and label who it applies to, e.g. "INR 4.5 lakh/year for domestic students (international fee not listed)". Never output only "Contact university" when any fee appears in the sources.
6. admissionRequirements: list each requirement separated by "; " so they can wrap onto multiple lines.

Each object in the JSON array MUST have exactly these fields:
{
  "universityName": "string",
  "universityLocation": "City, State/Province, Country — only if present in the source",
  "courseName": "string",
  "courseLevel": "${level === "Any" ? "the actual programme level" : level}",
  "courseType": "string",
  "specialization": "string",
  "country": "string",
  "qsWorldRanking": number or null,
  "tuitionFee": "annual fee with currency and which student type it applies to",
  "admissionRequirements": "requirement 1; requirement 2; requirement 3",
  "courseUrl": "MUST be copied EXACTLY from a source URL below",
  "duration": "e.g. 4 years",
  "language": "e.g. English",
  "intakePeriod": "e.g. Fall 2026",
  "scholarshipInfo": "available scholarships or None"
}

Include every matching source university. Unranked universities that match the specialization must still appear. Prefer official university course/programme pages over ranking portals.

Brave Search sources:
${formatSourcesForPrompt(sources)}`;
}

export function extractJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON array.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown[];
}

function messageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
    if (joined.trim()) return joined;
  }
  for (const key of ["reasoning", "reasoning_content", "reasoningContent"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function normalizeResult(
  item: Record<string, unknown>,
  index: string | number,
  sources: BraveWebResult[]
): UniversityCourseResult {
  const qs = item.qsWorldRanking;
  const universityName = String(item.universityName ?? "Unknown University");
  const courseName = String(item.courseName ?? "Unknown Course");
  return {
    id: `result-${index}-${Date.now()}`,
    universityName,
    universityLocation: String(item.universityLocation ?? ""),
    courseName,
    courseLevel: String(item.courseLevel ?? ""),
    courseType: String(item.courseType ?? ""),
    specialization: String(item.specialization ?? ""),
    country: String(item.country ?? ""),
    qsWorldRanking:
      typeof qs === "number" && !Number.isNaN(qs)
        ? qs
        : qs === null
          ? null
          : Number.isFinite(Number(qs))
            ? Number(qs)
            : null,
    tuitionFee: String(item.tuitionFee ?? "Contact university"),
    admissionRequirements: String(item.admissionRequirements ?? ""),
    courseUrl: resolveCourseUrl(
      universityName,
      courseName,
      safeHttpUrl(item.courseUrl),
      sources
    ),
    duration: String(item.duration ?? ""),
    language: String(item.language ?? ""),
    intakePeriod: String(item.intakePeriod ?? ""),
    scholarshipInfo: String(item.scholarshipInfo ?? ""),
  };
}

function modelQueue(configured: string): string[] {
  const primary = RETIRED_MODELS.has(configured) ? DEFAULT_MODEL : configured;
  return [...new Set([primary, DEFAULT_MODEL, ...FALLBACK_MODELS])];
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function createInferenceClient(): {
  hf: InferenceClient;
  model: string;
} {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }
  return {
    hf: new InferenceClient(apiKey),
    model: process.env.HF_MODEL ?? DEFAULT_MODEL,
  };
}

export async function completeWithFallback(
  hf: InferenceClient,
  prompt: string,
  configuredModel: string
): Promise<string> {
  const models = modelQueue(configuredModel);
  let lastError: unknown;

  for (const [index, model] of models.entries()) {
    const timeoutMs = index === 0 ? PRIMARY_TIMEOUT_MS : FALLBACK_TIMEOUT_MS;
    try {
      const response = await hf.chatCompletion(
        {
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.2,
        },
        {
          retry_on_error: false,
          signal: AbortSignal.timeout(timeoutMs),
        }
      );

      const content = messageText(response.choices[0]?.message);
      if (!content.trim()) {
        throw new Error("Empty response from Hugging Face model.");
      }
      if (index > 0) {
        console.warn(`Search used fallback model ${model}`);
      }
      return content;
    } catch (error) {
      lastError = error;
      console.error(`Inference failed for ${model}:`, error);
      const status =
        error instanceof InferenceClientProviderApiError
          ? error.httpResponse.status
          : 0;
      if (status === 401 || status === 403) {
        throw new Error(
          "HUGGINGFACE_API_KEY is invalid or missing Inference Providers permission."
        );
      }
    }
  }

  if (lastError instanceof InferenceClientProviderApiError || isAbortError(lastError)) {
    throw new Error(
      "The language model provider timed out or is temporarily unavailable. Please try again."
    );
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Search failed. Please try again.");
}

const PER_COUNTRY_RESULTS = 12;

function namedLikeUniversity(value: string): boolean {
  return /\b(university|institute|college|vidyapeetham|vidyapeeth|iit|iiit|nit|polytechnic|bits)\b/i.test(
    value
  );
}

function applyUniversityNamesFromSources(
  results: UniversityCourseResult[],
  sources: BraveWebResult[]
): UniversityCourseResult[] {
  return results.map((result) => {
    const source =
      sources.find((item) => item.url === result.courseUrl) ??
      sources.find(
        (item) =>
          registrableHost(item.url) === registrableHost(result.courseUrl)
      );
    const official = source
      ? universityNameFromSource(source)
      : nameFromRegistrableHost(result.courseUrl);
    if (!official) return result;
    if (
      isPromotionalUniversityName(result.universityName) ||
      !namedLikeUniversity(result.universityName)
    ) {
      return { ...result, universityName: official };
    }
    return result;
  });
}

function pickCountryResults(
  merged: UniversityCourseResult[],
  specialization: string
): UniversityCourseResult[] {
  const sorted = merged
    .slice()
    .sort((a, b) => compareSearchResults(a, b, specialization));
  const matching = sorted.filter(
    (course) =>
      specializationMatchScore(
        `${course.universityName} ${course.courseName} ${course.specialization} ${course.courseUrl}`,
        specialization
      ) > 0
  );
  const rest = sorted.filter((course) => !matching.includes(course));
  const keptMatching = matching.slice(0, 15);
  const fill = rest.slice(0, Math.max(0, PER_COUNTRY_RESULTS - keptMatching.length));
  return [...keptMatching, ...fill];
}

function universityKey(course: UniversityCourseResult): string {
  const host = registrableHost(course.courseUrl);
  if (host) return `host:${host}`;
  return `name:${course.universityName
    .toLowerCase()
    .replace(
      /\b(the|university|universiti|institute|of|higher|education|and|&|research|college|deemed)\b/g,
      ""
    )
    .replace(/[^a-z0-9]+/g, "")}`;
}

function courseRelevance(course: UniversityCourseResult, specialization: string): number {
  return specializationMatchScore(
    `${course.universityName} ${course.courseName} ${course.specialization} ${course.courseUrl}`,
    specialization
  );
}

function isPreferredDuplicate(
  candidate: UniversityCourseResult,
  existing: UniversityCourseResult,
  specialization: string
): boolean {
  const promoDiff =
    Number(isPromotionalUniversityName(existing.universityName)) -
    Number(isPromotionalUniversityName(candidate.universityName));
  if (promoDiff !== 0) return promoDiff > 0;
  const majorDiff =
    majorUniversityScore(candidate.universityName, candidate.courseUrl) -
    majorUniversityScore(existing.universityName, existing.courseUrl);
  if (majorDiff !== 0) return majorDiff > 0;
  const scoreDiff =
    courseRelevance(candidate, specialization) - courseRelevance(existing, specialization);
  if (scoreDiff !== 0) return scoreDiff > 0;
  return compareRanking(candidate.qsWorldRanking, existing.qsWorldRanking) < 0;
}

function mergeCountryResults(
  batches: UniversityCourseResult[][],
  specialization = ""
): UniversityCourseResult[] {
  const byKey = new Map<string, UniversityCourseResult>();
  for (const item of batches.flat()) {
    const key = universityKey(item);
    const existing = byKey.get(key);
    if (!existing || isPreferredDuplicate(item, existing, specialization)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

function coursesFromBraveSources(
  sources: BraveWebResult[],
  criteria: SearchCriteriaInput,
  idPrefix: string
): UniversityCourseResult[] {
  const picked = prioritizeMajorUniversitySources(sources, sources.length);
  return picked.map((source, index) => {
    const courseName = courseNameFromSource(
      source,
      criteria.specialization.trim() || criteria.courseType.trim()
    );
    return enrichCourseResult(
      {
        id: `result-${idPrefix}-brave-${index}-${Date.now()}`,
        universityName: universityNameFromSource(source),
        universityLocation: "",
        courseName,
        courseLevel: criteria.courseLevel,
        courseType: criteria.courseType,
        specialization: criteria.specialization,
        country: criteria.countries[0] ?? "",
        qsWorldRanking: null,
        tuitionFee: "",
        admissionRequirements: source.description,
        courseUrl: source.url,
        duration: "",
        language: "",
        intakePeriod: "",
        scholarshipInfo: "",
      },
      criteria,
      [source]
    );
  });
}

async function searchOneCountry(
  criteria: SearchCriteriaInput,
  hf: InferenceClient,
  model: string,
  idPrefix: string
): Promise<UniversityCourseResult[]> {
  const sources = await searchCourseSources(criteria);
  if (sources.length === 0) return [];

  let extracted: UniversityCourseResult[] = [];
  try {
    const content = await completeWithFallback(
      hf,
      buildSearchPrompt(criteria, sources),
      model
    );
    const raw = extractJsonArray(content);
    extracted = filterResultsByCourseLevel(
      applyUniversityNamesFromSources(
        raw.map((item, index) =>
          normalizeResult(
            item as Record<string, unknown>,
            `${idPrefix}-${index}`,
            sources
          )
        ),
        sources
      ).map((result) => enrichCourseResult(result, criteria, sources)),
      criteria.courseLevel
    );
  } catch (error) {
    console.error(`Model extract failed for ${idPrefix}:`, error);
  }

  const fromBrave = coursesFromBraveSources(sources, criteria, idPrefix);
  const merged = applyUniversityNamesFromSources(
    mergeCountryResults([extracted, fromBrave], criteria.specialization),
    sources
  );
  if (extracted.length > 0 && extracted.length < 5 && fromBrave.length > 0) {
    console.warn(
      `Search for ${idPrefix}: ${extracted.length} model course(s), supplemented to ${merged.length} from Brave`
    );
  }
  if (extracted.length === 0 && fromBrave.length > 0) {
    console.warn(`Using Brave Search pages directly for ${idPrefix}`);
  }
  return pickCountryResults(merged, criteria.specialization);
}

export async function searchUniversityCourses(
  criteria: SearchCriteriaInput
): Promise<CourseSearchOutcome> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }

  const countries = criteria.countries.map((country) => country.trim()).filter(Boolean);
  if (countries.length > MAX_SEARCH_COUNTRIES) {
    return {
      results: [],
      warning: tooManyCountriesWarning(countries.length),
    };
  }

  const regions = countries.length > 0 ? countries : [""];
  const model = process.env.HF_MODEL ?? DEFAULT_MODEL;
  const hf = new InferenceClient(apiKey);
  const batches: UniversityCourseResult[][] = [];

  for (const [index, country] of regions.entries()) {
    const regionCriteria = {
      ...criteria,
      countries: country ? [country] : [],
    };
    try {
      const batch = await searchOneCountry(
        regionCriteria,
        hf,
        model,
        country || `any-${index}`
      );
      batches.push(batch);
    } catch (error) {
      console.error(`Search failed for ${country || "any country"}:`, error);
      if (regions.length === 1) throw error;
    }
  }

  const combined = filterResultsByCourseLevel(
    mergeCountryResults(batches, criteria.specialization),
    criteria.courseLevel
  );
  if (combined.length === 0) {
    throw new Error(
      "No matching courses were found. Try different criteria or fewer countries."
    );
  }

  const ranked = combined
    .slice()
    .sort((a, b) => compareSearchResults(a, b, criteria.specialization));
  const selected =
    ranked.length > MAX_COMBINED_RESULTS
      ? ranked.slice(0, MAX_COMBINED_RESULTS)
      : ranked;

  const withUrls = await fillMissingCourseUrls(selected);
  const verified = withUrls.filter((result) => result.courseUrl);
  const named = (verified.length >= 5 ? verified : withUrls).map((result) => {
    if (!isPromotionalUniversityName(result.universityName)) return result;
    const fromHost = nameFromRegistrableHost(result.courseUrl);
    return fromHost ? { ...result, universityName: fromHost } : result;
  });

  return {
    results: named.sort((a, b) =>
      compareSearchResults(a, b, criteria.specialization)
    ),
  };
}
