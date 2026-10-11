import { majorUniversityScore } from "./major-universities";

/**
 * Orders QS World Rankings best-first. A missing ranking always sorts after a
 * known one, in either sort direction, so unranked universities never displace
 * ranked ones at the top of a table.
 */
export function compareRanking(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

const SPECIALIZATION_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "course",
  "degree",
  "engineering",
  "science",
  "studies",
  "program",
  "programme",
]);

export function specializationTokens(specialization: string): string[] {
  return specialization
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !SPECIALIZATION_STOPWORDS.has(token));
}

export function specializationMatchScore(
  haystack: string,
  specialization: string
): number {
  const tokens = specializationTokens(specialization);
  if (tokens.length === 0) return 0;
  const text = haystack.toLowerCase();
  return tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
}

export function compareSearchResults(
  a: {
    qsWorldRanking: number | null;
    universityName: string;
    courseName: string;
    specialization: string;
    courseUrl: string;
  },
  b: {
    qsWorldRanking: number | null;
    universityName: string;
    courseName: string;
    specialization: string;
    courseUrl: string;
  },
  specialization: string
): number {
  const majorA = majorUniversityScore(a.universityName, a.courseUrl);
  const majorB = majorUniversityScore(b.universityName, b.courseUrl);
  if (majorA !== majorB) return majorB - majorA;
  const scoreA = specializationMatchScore(
    `${a.universityName} ${a.courseName} ${a.specialization} ${a.courseUrl}`,
    specialization
  );
  const scoreB = specializationMatchScore(
    `${b.universityName} ${b.courseName} ${b.specialization} ${b.courseUrl}`,
    specialization
  );
  if (scoreA !== scoreB) return scoreB - scoreA;
  return compareRanking(a.qsWorldRanking, b.qsWorldRanking);
}
