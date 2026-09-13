import {
  CANDIDATE_TYPES,
  COURSE_LEVELS,
  COURSE_TYPES,
  DEFAULT_SEARCH_CRITERIA,
} from "./constants";
import { safeHttpUrl } from "./url";
import type {
  CandidateType,
  CourseLevel,
  CourseType,
  SearchCriteria,
  UniversityCourseResult,
} from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asCourseLevel(value: unknown): CourseLevel | "" {
  return COURSE_LEVELS.includes(value as CourseLevel) ? (value as CourseLevel) : "";
}

function asCourseType(value: unknown): CourseType | "" {
  return COURSE_TYPES.includes(value as CourseType) ? (value as CourseType) : "";
}

function asCandidateType(value: unknown): CandidateType | "" {
  return CANDIDATE_TYPES.some((item) => item.value === value)
    ? (value as CandidateType)
    : "";
}

export function parseSearchCriteria(value: unknown): SearchCriteria {
  if (!value || typeof value !== "object") {
    return DEFAULT_SEARCH_CRITERIA;
  }

  const raw = value as Record<string, unknown>;
  const countries = Array.isArray(raw.countries)
    ? raw.countries.filter((item): item is string => typeof item === "string")
    : [];

  return {
    courseLevel: asCourseLevel(raw.courseLevel),
    courseType: asCourseType(raw.courseType),
    specialization: asString(raw.specialization),
    countries,
    candidateType: asCandidateType(raw.candidateType),
    lastQualification: asString(raw.lastQualification),
    lastSchool: asString(raw.lastSchool),
    curriculum: asString(raw.curriculum),
    subjects: asString(raw.subjects),
    grades: asString(raw.grades),
    budgetMax: asString(raw.budgetMax),
    additionalNotes: asString(raw.additionalNotes),
  };
}

function parseResult(
  item: unknown,
  index: number
): UniversityCourseResult | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  const universityName = asString(raw.universityName);
  const courseName = asString(raw.courseName);
  if (!universityName || !courseName) return null;

  const qs = raw.qsWorldRanking;
  return {
    id: asString(raw.id) || `restored-${index}`,
    universityName,
    universityLocation: asString(raw.universityLocation),
    courseName,
    courseLevel: asString(raw.courseLevel),
    courseType: asString(raw.courseType),
    specialization: asString(raw.specialization),
    country: asString(raw.country),
    qsWorldRanking:
      typeof qs === "number" && Number.isFinite(qs)
        ? qs
        : Number.isFinite(Number(qs)) && qs !== null && qs !== ""
          ? Number(qs)
          : null,
    tuitionFee: asString(raw.tuitionFee),
    admissionRequirements: asString(raw.admissionRequirements),
    courseUrl: safeHttpUrl(raw.courseUrl),
    duration: asString(raw.duration),
    language: asString(raw.language),
    intakePeriod: asString(raw.intakePeriod),
    scholarshipInfo: asString(raw.scholarshipInfo),
  };
}

export function parseSearchResults(value: unknown): UniversityCourseResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => parseResult(item, index))
    .filter((item): item is UniversityCourseResult => item !== null);
}
