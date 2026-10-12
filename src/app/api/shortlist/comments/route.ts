import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAccess, wishlistAccess } from "@/lib/wishlist-access";

const createSchema = z.object({
  courseId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  const { data, error } = await supabase
    .from("shortlist_comments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const { data: course, error: loadError } = await supabase
    .from("shortlisted_courses")
    .select("id, user_id")
    .eq("id", parsed.data.courseId)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const access = await wishlistAccess(supabase, course.user_id, user.id, user.email);
  if (!assertAccess(access, "comment")) {
    return NextResponse.json({ error: "You cannot comment on this wishlist" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("shortlist_comments")
    .insert({
      course_id: course.id,
      author_id: user.id,
      author_email: user.email.toLowerCase(),
      body: parsed.data.body,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}
