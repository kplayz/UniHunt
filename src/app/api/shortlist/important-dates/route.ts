import { NextResponse } from "next/server";
import { z } from "zod";
import { findImportantDates } from "@/lib/important-dates";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { assertAccess, wishlistAccess } from "@/lib/wishlist-access";

/** Four Brave queries (1 req/s), up to six page fetches, then one model call. */
export const maxDuration = 120;

const requestSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: z.prettifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { data: course, error: loadError } = await supabase
    .from("shortlisted_courses")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const access = await wishlistAccess(supabase, course.user_id, user.id, user.email);
  if (!assertAccess(access, "edit")) {
    return NextResponse.json({ error: "You cannot refresh dates on this wishlist" }, { status: 403 });
  }

  try {
    const report = await findImportantDates({
      universityName: course.university_name,
      courseName: course.course_name,
      courseUrl: course.course_url,
      country: course.country,
      courseLevel: course.course_level,
    });

    const { data: updated, error: updateError } = await supabase
      .from("shortlisted_courses")
      .update({
        important_dates: report as unknown as Json,
        important_dates_checked_at: report.checkedAt,
      })
      .eq("id", course.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Important dates lookup failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Could not search the university website. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
