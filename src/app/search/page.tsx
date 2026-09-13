import { redirect } from "next/navigation";
import { SearchView } from "@/components/search/search-view";
import { parseSearchCriteria, parseSearchResults } from "@/lib/search-session";
import { createClient } from "@/lib/supabase/server";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: shortlist }, { data: lastSession }] = await Promise.all([
    supabase
      .from("shortlisted_courses")
      .select("university_name, course_name")
      .eq("user_id", user.id),
    supabase
      .from("search_sessions")
      .select("criteria, results, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const shortlistedKeys = (shortlist ?? []).map(
    (item) => `${item.university_name}|${item.course_name}`
  );

  return (
    <SearchView
      userEmail={user.email ?? null}
      shortlistedKeys={shortlistedKeys}
      initialCriteria={
        lastSession ? parseSearchCriteria(lastSession.criteria) : undefined
      }
      initialResults={
        lastSession ? parseSearchResults(lastSession.results) : undefined
      }
      lastSearchedAt={lastSession?.created_at ?? null}
    />
  );
}
