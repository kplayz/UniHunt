import type {
  CandidateType,
  CourseLevel,
  CourseType,
  SearchCriteria,
} from "./types";

export const COURSE_LEVELS: CourseLevel[] = [
  "Diploma",
  "Certificate",
  "Associate",
  "Undergraduate",
  "Postgraduate",
  "Masters",
  "Doctorate",
  "Postdoctoral",
];

export const COURSE_TYPES: CourseType[] = [
  "Engineering",
  "Medicine",
  "Bachelor's",
  "Master's",
  "Masters Integrated",
  "PhD",
  "Business",
  "Law",
  "Arts & Humanities",
  "Science",
  "Technology",
  "Other",
];

export const CANDIDATE_TYPES: { value: CandidateType; label: string }[] = [
  { value: "in-state", label: "In-State (domestic, same state/province)" },
  { value: "out-of-state", label: "Out-of-State (domestic, different region)" },
  { value: "out-of-country", label: "Out-of-Country (international)" },
];

export const DEFAULT_SEARCH_CRITERIA: SearchCriteria = {
  courseLevel: "",
  courseType: "",
  specialization: "",
  countries: [],
  candidateType: "",
  lastQualification: "",
  lastSchool: "",
  curriculum: "",
  subjects: "",
  grades: "",
  budgetMax: "",
  additionalNotes: "",
};

/** Independent Brave + model searches run once per selected country. */
export const MAX_SEARCH_COUNTRIES = 5;

/** Combined unique courses after merging per-country searches. */
export const MAX_COMBINED_RESULTS = 25;

export function tooManyCountriesWarning(count: number): string {
  return `You selected ${count} countries. Each country is searched separately, so please select at most ${MAX_SEARCH_COUNTRIES} and retry.`;
}

export function tooManyResultsWarning(count: number): string {
  return `This search found ${count} courses, which is more than the limit of ${MAX_COMBINED_RESULTS}. Narrow the countries or other criteria and retry.`;
}
