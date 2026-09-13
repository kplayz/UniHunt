import { redirect } from "next/navigation";
import { ShortlistView } from "@/components/shortlist/shortlist-view";
import { createClient } from "@/lib/supabase/server";
import type { ShortlistedCourse } from "@/lib/types";

export default async function ShortlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("shortlisted_courses")
    .select("*")
    .eq("user_id", user.id)
    .order("qs_world_ranking", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load shortlist: ${error.message}`);
  }

  return (
    <ShortlistView
      userEmail={user.email ?? null}
      items={(data ?? []) as ShortlistedCourse[]}
    />
  );
}
