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
} from "./brave";
import { compareRanking } from "./ranking";
import type { SearchCriteriaInput, UniversityCourseResult } from "./types";
import { safeHttpUrl } from "./url";

const DEFAULT_MODEL = "Qwen/Qwen2.5-72B-Instruct";
const FALLBACK_MODELS = [
  "openai/gpt-oss-20b:fastest",
  "Qwen/Qwen3-8B:fastest",
];
const MAX_OUTPUT_TOKENS = 1800;
const PRIMARY_TIMEOUT_MS = 40_000;
const FALLBACK_TIMEOUT_MS = 25_000;

function buildSearchPrompt(
  criteria: SearchCriteriaInput,
  sources: BraveWebResult[]
): string {
  return `You are an expert university admissions counselor.

Use ONLY the live Brave Search results below. Do not invent universities, courses, or URLs. If a programme is not clearly supported by a source, omit it.

Return ONLY a valid JSON array (no markdown, no explanation) of 8-10 university course recommendations.

Candidate criteria:
- Course Level: ${criteria.courseLevel || "Any"}
- Course Type: ${criteria.courseType || "Any"}
- Specialization: ${criteria.specialization || "Any"}
- Preferred Countries: ${criteria.countries.length ? criteria.countries.join(", ") : "Any"}
- Candidate Type: ${criteria.candidateType || "Any"} (use this to estimate tuition: in-state = domestic local rate, out-of-state = domestic non-local rate, out-of-country = international rate)
- Last Qualification: ${criteria.lastQualification || "Not specified"}
- Last School/College: ${criteria.lastSchool || "Not specified"}
- Curriculum: ${criteria.curriculum || "Not specified"}
- Subjects/Courses taken: ${criteria.subjects || "Not specified"}
- Grades/GPA/CGPA: ${criteria.grades || "Not specified"}
- Budget restriction (max annual tuition): ${criteria.budgetMax ? `$${criteria.budgetMax} USD equivalent` : "Not specified"}
- Additional notes: ${criteria.additionalNotes || "None"}

Each object in the JSON array MUST have exactly these fields:
{
  "universityName": "string",
  "universityLocation": "City, State/Province, Country",
  "courseName": "string",
  "courseLevel": "string",
  "courseType": "string",
  "specialization": "string",
  "country": "string",
  "qsWorldRanking": number or null,
  "tuitionFee": "approximate annual fee with currency for the candidate type",
  "admissionRequirements": "key requirements summary",
  "courseUrl": "MUST be copied EXACTLY from a source URL below",
  "duration": "e.g. 4 years",
  "language": "e.g. English",
  "intakePeriod": "e.g. Fall 2026",
  "scholarshipInfo": "available scholarships or None"
}

Sort results by QS World Ranking (best/lowest number first). If QS ranking is unknown, use null. Prefer official university course/programme pages over ranking portals.

Brave Search sources:
${formatSourcesForPrompt(sources)}`;
}

function extractJsonArray(text: string): unknown[] {
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

function normalizeResult(
  item: Record<string, unknown>,
  index: number,
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
  const primary =
    configured === DEFAULT_MODEL
      ? "Qwen/Qwen2.5-72B-Instruct:novita"
      : configured;
  return [...new Set([primary, ...FALLBACK_MODELS])];
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function completeWithFallback(
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

      const content = response.choices[0]?.message?.content;
      if (!content) {
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

export async function searchUniversityCourses(
  criteria: SearchCriteriaInput
): Promise<UniversityCourseResult[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }

  const sources = await searchCourseSources(criteria);
  if (sources.length === 0) {
    throw new Error(
      "Brave Search returned no university course pages. Try different criteria."
    );
  }

  const model = process.env.HF_MODEL ?? DEFAULT_MODEL;
  const hf = new InferenceClient(apiKey);
  const content = await completeWithFallback(
    hf,
    buildSearchPrompt(criteria, sources),
    model
  );

  const raw = extractJsonArray(content);
  const extracted = raw.map((item, index) =>
    normalizeResult(item as Record<string, unknown>, index, sources)
  );
  const withUrls = await fillMissingCourseUrls(extracted);
  const verified = withUrls.filter((result) => result.courseUrl);
  const results = verified.length >= 5 ? verified : withUrls;

  return results.sort((a, b) => compareRanking(a.qsWorldRanking, b.qsWorldRanking));
}
