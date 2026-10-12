import { isOfficialUniversityUrl, registrableHost, universityOwnsUrl } from "./brave";
import { matchesCourseLevel } from "./course-match";
import { qualificationAllows } from "./candidate-fit";
import { duckDuckGoSearch, type WebHit } from "./duckduckgo";
import { specializationTokens } from "./ranking";
import type { SearchCriteriaInput, UniversityCourseResult } from "./types";

function haystack(course: UniversityCourseResult): string {
  return `${course.universityName} ${course.courseName} ${course.specialization} ${course.courseUrl} ${course.admissionRequirements} ${course.country} ${course.universityLocation}`.toLowerCase();
}

/** Drop a course that contradicts the level, subject, country, or qualification. */
export function matchesSearchCriteria(
  course: UniversityCourseResult,
  criteria: SearchCriteriaInput
): boolean {
  if (
    criteria.courseLevel.trim() &&
    !matchesCourseLevel(
      criteria.courseLevel,
      course.courseLevel,
      course.courseName,
      course.courseUrl
    )
  ) {
    return false;
  }
  if (!qualificationAllows(course.courseLevel || criteria.courseLevel, criteria.lastQualification)) {
    return false;
  }
  if (criteria.countries.length > 0) {
    const place = `${course.country} ${course.universityLocation} ${course.courseUrl}`.toLowerCase();
    const listed = criteria.countries.some((country) => place.includes(country.trim().toLowerCase()));
    if (!listed) return false;
  }
  const tokens = specializationTokens(criteria.specialization);
  if (tokens.length > 0 && !tokens.some((token) => haystack(course).includes(token))) {
    return false;
  }
  return true;
}

function corroborates(
  course: UniversityCourseResult,
  hits: WebHit[],
  criteria: SearchCriteriaInput
): boolean {
  const courseHost = registrableHost(course.courseUrl);
  if (!courseHost || !isOfficialUniversityUrl(course.courseUrl)) return false;
  const subjectTokens = specializationTokens(
    criteria.specialization.trim() || course.courseName
  );
  return hits.some((hit) => {
    if (!isOfficialUniversityUrl(hit.url)) return false;
    if (registrableHost(hit.url) !== courseHost) return false;
    const subjectHit =
      subjectTokens.length === 0 ||
      subjectTokens.some((token) =>
        `${hit.title} ${hit.snippet} ${hit.url}`.toLowerCase().includes(token)
      );
    const levelOk = matchesCourseLevel(criteria.courseLevel, hit.title, hit.snippet, hit.url);
    return levelOk && subjectHit;
  });
}

function validationQuery(course: UniversityCourseResult, criteria: SearchCriteriaInput): string {
  const host = registrableHost(course.courseUrl);
  const subject = criteria.specialization.trim() || course.courseName;
  const level = criteria.courseLevel.trim() || course.courseLevel;
  return [host ? `site:${host}` : "", `"${course.universityName}"`, subject, level, "course"]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export interface CrossCheckOutcome {
  results: UniversityCourseResult[];
  /** Set when courses were removed, or when DuckDuckGo could not be reached. */
  warning?: string;
}

/**
 * Keep a course only when its page is the university's own site, it matches
 * the criteria, and DuckDuckGo finds that same site offering the subject.
 */
export async function crossValidateCourses(
  courses: UniversityCourseResult[],
  criteria: SearchCriteriaInput
): Promise<CrossCheckOutcome> {
  const relevant = courses.filter(
    (course) =>
      isOfficialUniversityUrl(course.courseUrl) &&
      universityOwnsUrl(course.universityName, course.courseUrl) &&
      matchesSearchCriteria(course, criteria)
  );
  const criteriaDropped = courses.length - relevant.length;
  if (relevant.length === 0) {
    return {
      results: [],
      warning:
        "No courses matched your level, subject, country, and qualification. Try a broader specialization or a different level.",
    };
  }

  const checks = await mapPool(relevant, 3, async (course) => {
    try {
      const hits = await duckDuckGoSearch(validationQuery(course, criteria));
      if (hits === null) return { course, keep: true, unchecked: true };
      return { course, keep: corroborates(course, hits, criteria), unchecked: false };
    } catch (error) {
      console.error(`DuckDuckGo cross-check failed for ${course.universityName}:`, error);
      return { course, keep: true, unchecked: true };
    }
  });

  const kept = checks.filter((check) => check.keep).map((check) => check.course);
  const removed = checks.filter((check) => !check.keep);
  const unchecked = checks.filter((check) => check.unchecked).length;
  for (const check of removed) {
    console.info(
      `Cross-check removed ${check.course.universityName} — ${check.course.courseName}`
    );
  }

  if (kept.length === 0) {
    return {
      results: [],
      warning:
        "DuckDuckGo could not confirm any of these courses on the university's official website.",
    };
  }

  const dropped = criteriaDropped + removed.length;
  let warning: string | undefined;
  if (unchecked === checks.length) {
    warning =
      "DuckDuckGo was unavailable, so only courses already found on an official university website are shown.";
  } else if (dropped > 0) {
    warning = `Removed ${dropped} course${dropped === 1 ? "" : "s"} that did not match your criteria or could not be confirmed on the university's official website.`;
  }

  return { results: kept, warning };
}
