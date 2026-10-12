import { majorUniversityScore } from "./major-universities";
import type { SearchCriteriaInput, UniversityCourseResult } from "./types";

/** How realistic a course is for this candidate. */
export type FitCategory = "dream" | "reach" | "target";

export interface CourseFit {
  fit: FitCategory;
  fitReason: string;
}

const FIT_ORDER: Record<FitCategory, number> = {
  target: 0,
  reach: 1,
  dream: 2,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function mapRange(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  if (fromMax === fromMin) return toMin;
  const ratio = (value - fromMin) / (fromMax - fromMin);
  return toMin + ratio * (toMax - toMin);
}

/** 0–100 academic strength, or null when the candidate did not enter grades. */
export function academicStrength(criteria: Pick<SearchCriteriaInput, "grades" | "curriculum">): number | null {
  const grades = criteria.grades.trim();
  if (!grades) return null;
  const curriculum = `${criteria.curriculum} ${grades}`.toLowerCase();

  const ib = grades.match(/(\d{1,2})\s*\/\s*45\b/);
  if (ib || /\bib\b|international baccalaureate/.test(curriculum)) {
    const score = Number(ib?.[1] ?? grades.match(/\b(\d{1,2})\b/)?.[1]);
    if (score > 0 && score <= 45) return clamp(mapRange(score, 24, 45, 50, 99));
  }

  const letters = grades.toUpperCase().match(/A\*|[A-E]/g);
  if (letters && letters.length >= 2 && /a-?\s?level|alevel/.test(curriculum)) {
    const points: Record<string, number> = { "A*": 56, A: 48, B: 40, C: 32, D: 24, E: 16 };
    const average = letters.reduce((sum, grade) => sum + (points[grade] ?? 20), 0) / letters.length;
    return clamp(mapRange(average, 32, 56, 60, 98));
  }

  const numeric = Number(grades.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (grades.includes("%") || numeric > 10) return clamp(numeric);
  if (numeric <= 4 || /\bgpa\b|4\.0|4-point/.test(curriculum)) {
    return clamp(mapRange(numeric, 2, 4, 50, 98));
  }
  return clamp(numeric * 10);
}

type PriorStudy = "school" | "bachelor" | "master" | "doctor" | "unknown";

function priorStudy(qualification: string): PriorStudy {
  const text = qualification.toLowerCase();
  if (!text.trim()) return "unknown";
  if (/ph\.?d|doctorate|doctoral/.test(text)) return "doctor";
  if (/master|postgrad|m\.?\s?sc|m\.?\s?tech|mba|mphil/.test(text)) return "master";
  if (/bachelor|b\.?\s?tech|b\.?\s?e|bsc|b\.sc|undergraduate|degree/.test(text)) return "bachelor";
  if (/high school|secondary|12th|grade 12|a-?\s?level|ib diploma|cbse|igcse|gcse|diploma/.test(text)) {
    return "school";
  }
  return "unknown";
}

function courseFamily(level: string): PriorStudy {
  const text = level.toLowerCase();
  if (/post-?doc|doctor|ph\.?d/.test(text)) return "doctor";
  if (/master|postgrad|mba|mphil/.test(text)) return "master";
  if (/bachelor|undergrad|associate|diploma|certificate/.test(text)) return "school";
  return "unknown";
}

/** School leavers are not eligible for a master's or doctorate. */
export function qualificationAllows(
  courseLevel: string,
  qualification: string
): boolean {
  const prior = priorStudy(qualification);
  const needed = courseFamily(courseLevel);
  if (prior === "unknown" || needed === "unknown" || needed === "school") return true;
  if (needed === "master") return prior === "bachelor" || prior === "master" || prior === "doctor";
  if (needed === "doctor") return prior !== "school";
  return true;
}

const USD_PER: Record<string, number> = {
  usd: 1,
  $: 1,
  inr: 1 / 83,
  "₹": 1 / 83,
  eur: 1.08,
  "€": 1.08,
  gbp: 1.27,
  "£": 1.27,
  aud: 0.66,
  cad: 0.74,
  sgd: 0.75,
};

/** Best-effort annual tuition in USD. Returns null when the fee is not numeric. */
export function annualTuitionUsd(tuition: string): number | null {
  const text = tuition.toLowerCase();
  if (!text.trim()) return null;
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*lakh/);
  if (lakh) return Number(lakh[1]) * 100_000 * (1 / 83);
  const crore = text.match(/(\d+(?:\.\d+)?)\s*crore/);
  if (crore) return Number(crore[1]) * 10_000_000 * (1 / 83);

  const amount = text.match(/(?:usd|inr|eur|gbp|aud|cad|sgd|[$€£₹])\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(usd|inr|eur|gbp|aud|cad|sgd)/i);
  if (!amount) return null;
  const raw = Number((amount[1] ?? amount[2]).replace(/,/g, ""));
  if (!Number.isFinite(raw)) return null;
  const currency = (amount[0].match(/usd|inr|eur|gbp|aud|cad|sgd|[$€£₹]/i)?.[0] ?? "usd").toLowerCase();
  const usd = raw * (USD_PER[currency] ?? 1);
  if (/semester|term/.test(text) && !/year|annual/.test(text)) return usd * 2;
  return usd;
}

function budgetUsd(budgetMax: string): number | null {
  const numeric = Number(budgetMax.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function selectivityBar(rank: number | null, universityName: string, courseUrl: string): number {
  const major = majorUniversityScore(universityName, courseUrl) > 0;
  const effective = rank ?? (major ? 200 : 700);
  if (effective <= 30) return 94;
  if (effective <= 100) return 88;
  if (effective <= 300) return 80;
  if (effective <= 600) return 72;
  return 64;
}

function subjectOverlap(course: Pick<UniversityCourseResult, "courseName" | "specialization" | "admissionRequirements">, subjects: string): number {
  const tokens = subjects
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((token) => token.length > 3);
  if (tokens.length === 0) return 0;
  const haystack = `${course.courseName} ${course.specialization} ${course.admissionRequirements}`.toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

function stepDown(fit: FitCategory): FitCategory {
  if (fit === "target") return "reach";
  return "dream";
}

/**
 * Label a course from the candidate profile: grades versus selectivity, budget
 * versus published tuition, and whether their qualification can enter the level.
 */
export function classifyCourseFit(
  course: Pick<
    UniversityCourseResult,
    | "universityName"
    | "courseName"
    | "courseLevel"
    | "specialization"
    | "qsWorldRanking"
    | "tuitionFee"
    | "admissionRequirements"
    | "courseUrl"
    | "scholarshipInfo"
  >,
  criteria: SearchCriteriaInput
): CourseFit {
  const reasons: string[] = [];
  if (!qualificationAllows(course.courseLevel, criteria.lastQualification)) {
    return {
      fit: "dream",
      fitReason: `A ${course.courseLevel || "higher"} course needs a higher qualification than “${criteria.lastQualification.trim()}”.`,
    };
  }

  const strength = academicStrength(criteria);
  const bar = selectivityBar(course.qsWorldRanking, course.universityName, course.courseUrl);
  let fit: FitCategory;
  if (strength === null) {
    if (course.qsWorldRanking !== null && course.qsWorldRanking <= 100) {
      fit = "dream";
      reasons.push("Highly selective, and grades were not entered");
    } else if (course.qsWorldRanking !== null && course.qsWorldRanking <= 400) {
      fit = "reach";
      reasons.push("Grades were not entered, so this stays a reach");
    } else {
      fit = "target";
      reasons.push("Grades were not entered; treated as a target until they are");
    }
  } else if (strength >= bar) {
    fit = "target";
    reasons.push("Grades meet the usual bar for this ranking");
  } else if (strength >= bar - 12) {
    fit = "reach";
    reasons.push("Grades are close to the usual bar for this ranking");
  } else {
    fit = "dream";
    reasons.push("Grades are below the usual bar for this ranking");
  }

  const budget = budgetUsd(criteria.budgetMax);
  const fee = annualTuitionUsd(course.tuitionFee);
  const scholarship = /scholarship|waiver|aid|bursary/i.test(
    `${course.scholarshipInfo} ${course.tuitionFee} ${criteria.additionalNotes}`
  );
  if (budget !== null && fee !== null) {
    if (fee > budget * 1.5 && !scholarship) {
      fit = "dream";
      reasons.push("Published tuition is well above the budget");
    } else if (fee > budget * 1.15) {
      fit = stepDown(fit);
      reasons.push(scholarship ? "Tuition is above budget, though aid is mentioned" : "Tuition is above the budget");
    } else {
      reasons.push("Tuition fits the budget");
    }
  } else if (budget !== null && fee === null) {
    reasons.push("Tuition was not published, so the budget could not be checked");
  }

  const overlap = subjectOverlap(course, criteria.subjects);
  const subjectCount = criteria.subjects.split(/[^a-z0-9+]+/i).filter((token) => token.length > 3).length;
  if (subjectCount > 0 && overlap === 0) {
    reasons.push("Listed subjects were not found on the course page");
  } else if (overlap > 0) {
    reasons.push("Course matches the subjects studied");
  }

  if (criteria.curriculum.trim()) {
    reasons.push(`${criteria.curriculum.trim()} curriculum noted`);
  }

  return { fit, fitReason: reasons.join(". ") + "." };
}

/**
 * Lower numbers sort first. Qualification and budget outrank a famous name
 * when the candidate cannot enter or afford the course.
 */
export function profilePenalty(course: UniversityCourseResult, criteria: SearchCriteriaInput): number {
  const fit = course.fit ? { fit: course.fit, fitReason: course.fitReason } : classifyCourseFit(course, criteria);
  let penalty = FIT_ORDER[fit.fit] * 15;
  if (!qualificationAllows(course.courseLevel, criteria.lastQualification)) penalty += 1000;
  const budget = budgetUsd(criteria.budgetMax);
  const fee = annualTuitionUsd(course.tuitionFee);
  if (budget !== null && fee !== null && fee > budget * 1.5) penalty += 250;
  else if (budget !== null && fee !== null && fee > budget * 1.15) penalty += 80;
  const overlap = subjectOverlap(course, criteria.subjects);
  if (criteria.subjects.trim() && overlap === 0) penalty += 25;
  else penalty -= overlap * 8;
  return penalty;
}

export function compareByCandidateProfile(
  a: UniversityCourseResult,
  b: UniversityCourseResult,
  criteria: SearchCriteriaInput
): number {
  return profilePenalty(a, criteria) - profilePenalty(b, criteria);
}

export function fitLabel(fit: FitCategory): string {
  if (fit === "dream") return "Dream";
  if (fit === "reach") return "Reach";
  return "Target";
}
