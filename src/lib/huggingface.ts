import { HfInference } from "@huggingface/inference";
import type { SearchCriteriaInput, UniversityCourseResult } from "./types";
import { compareRanking } from "./ranking";
import { safeHttpUrl } from "./url";

const DEFAULT_MODEL = "Qwen/Qwen2.5-72B-Instruct";

function buildSearchPrompt(criteria: SearchCriteriaInput): string {
  return `You are an expert university admissions counselor with up-to-date knowledge of global higher education.

Search the web and your knowledge to find real university courses matching these candidate criteria. Return ONLY a valid JSON array (no markdown, no explanation) of 8-15 university course recommendations.

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
  "courseUrl": "verified official university course page URL",
  "duration": "e.g. 4 years",
  "language": "e.g. English",
  "intakePeriod": "e.g. Fall 2026",
  "scholarshipInfo": "available scholarships or None"
}

Sort results by QS World Ranking (best/lowest number first). Use real universities with plausible official URLs. If QS ranking is unknown, use null.`;
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

function normalizeResult(item: Record<string, unknown>, index: number): UniversityCourseResult {
  const qs = item.qsWorldRanking;
  return {
    id: `result-${index}-${Date.now()}`,
    universityName: String(item.universityName ?? "Unknown University"),
    universityLocation: String(item.universityLocation ?? ""),
    courseName: String(item.courseName ?? "Unknown Course"),
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
    courseUrl: safeHttpUrl(item.courseUrl),
    duration: String(item.duration ?? ""),
    language: String(item.language ?? ""),
    intakePeriod: String(item.intakePeriod ?? ""),
    scholarshipInfo: String(item.scholarshipInfo ?? ""),
  };
}

export async function searchUniversityCourses(
  criteria: SearchCriteriaInput
): Promise<UniversityCourseResult[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }

  const model = process.env.HF_MODEL ?? DEFAULT_MODEL;
  const hf = new HfInference(apiKey);

  const response = await hf.chatCompletion({
    model,
    messages: [
      {
        role: "user",
        content: buildSearchPrompt(criteria),
      },
    ],
    max_tokens: 4096,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Hugging Face model.");
  }

  const raw = extractJsonArray(content);
  const results = raw.map((item, index) =>
    normalizeResult(item as Record<string, unknown>, index)
  );

  return results.sort((a, b) => compareRanking(a.qsWorldRanking, b.qsWorldRanking));
}
