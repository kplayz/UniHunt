"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { SearchForm } from "@/components/search/search-form";
import { ResultsTable } from "@/components/search/results-table";
import { DEFAULT_SEARCH_CRITERIA, MAX_SEARCH_COUNTRIES, tooManyCountriesWarning } from "@/lib/constants";
import type { SearchCriteria, UniversityCourseResult } from "@/lib/types";

interface SearchViewProps {
  userEmail: string | null;
  /** Identity keys of courses already on the user's shortlist, from the server. */
  shortlistedKeys: string[];
  initialCriteria?: SearchCriteria;
  initialResults?: UniversityCourseResult[];
  lastSearchedAt?: string | null;
}

/**
 * Must stay in step with the shortlisted_courses_user_course_idx unique index,
 * which ignores the URL — otherwise the button state and the API disagree about
 * what counts as already saved.
 */
function courseKey(course: UniversityCourseResult) {
  return `${course.universityName}|${course.courseName}`;
}

export function SearchView({
  userEmail,
  shortlistedKeys,
  initialCriteria,
  initialResults,
  lastSearchedAt,
}: SearchViewProps) {
  const [criteria, setCriteria] = useState<SearchCriteria>(
    initialCriteria ?? DEFAULT_SEARCH_CRITERIA
  );
  const [results, setResults] = useState<UniversityCourseResult[]>(
    initialResults ?? []
  );
  const [restoredAt, setRestoredAt] = useState<string | null>(
    lastSearchedAt ?? null
  );
  const [loading, setLoading] = useState(false);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(
    () => new Set(shortlistedKeys)
  );

  async function handleSearch() {
    setLoading(true);
    setResults([]);
    setRestoredAt(null);
    setSearchWarning(null);
    try {
      if (criteria.countries.length > MAX_SEARCH_COUNTRIES) {
        const warning = tooManyCountriesWarning(criteria.countries.length);
        setSearchWarning(warning);
        toast.warning(warning);
        return;
      }

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      if (data.warning) {
        setSearchWarning(data.warning);
        toast.warning(data.warning);
        setResults([]);
        return;
      }
      setResults(data.results);
      toast.success(`Found ${data.results.length} matching courses`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const handleShortlist = useCallback(
    async (course: UniversityCourseResult) => {
      const key = courseKey(course);
      if (savedKeys.has(key)) return;

      const res = await fetch("/api/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university_name: course.universityName,
          university_location: course.universityLocation,
          course_name: course.courseName,
          course_level: course.courseLevel,
          course_type: course.courseType,
          specialization: course.specialization,
          country: course.country,
          qs_world_ranking: course.qsWorldRanking,
          tuition_fee: course.tuitionFee,
          admission_requirements: course.admissionRequirements,
          course_url: course.courseUrl,
          duration: course.duration,
          language: course.language,
          intake_period: course.intakePeriod,
          scholarship_info: course.scholarshipInfo,
          is_manual: false,
        }),
      });

      // A conflict means it is already saved, so the button should still settle
      // into the "Added" state rather than reporting a failure.
      if (!res.ok && res.status !== 409) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to shortlist");
      }

      setSavedKeys((prev) => new Set(prev).add(key));
      toast.success(
        res.status === 409 ? "Already on your shortlist" : "Added to shortlist"
      );
    },
    [savedKeys]
  );

  const shortlistedIds = new Set(
    results.filter((r) => savedKeys.has(courseKey(r))).map((r) => r.id)
  );

  return (
    <div className="min-h-full bg-muted/20">
      <AppHeader userEmail={userEmail} />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <SearchForm
          criteria={criteria}
          onChange={setCriteria}
          onSearch={handleSearch}
          loading={loading}
          restoredAt={restoredAt}
          warning={searchWarning}
        />
        <ResultsTable
          results={results}
          shortlistedIds={shortlistedIds}
          onShortlist={handleShortlist}
          restored={Boolean(restoredAt && results.length > 0)}
        />
      </main>
    </div>
  );
}
