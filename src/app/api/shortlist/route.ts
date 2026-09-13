import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isHttpUrl } from "@/lib/url";

/** Postgres unique-violation, raised by the per-user duplicate course index. */
const UNIQUE_VIOLATION = "23505";

const shortlistSchema = z.object({
  university_name: z.string().min(1),
  university_location: z.string().optional(),
  course_name: z.string().min(1),
  course_level: z.string().optional(),
  course_type: z.string().optional(),
  specialization: z.string().optional(),
  country: z.string().optional(),
  qs_world_ranking: z.number().nullable().optional(),
  tuition_fee: z.string().optional(),
  admission_requirements: z.string().optional(),
  course_url: z
    .string()
    .optional()
    .refine((value) => !value || isHttpUrl(value), {
      message: "course_url must be an http(s) URL",
    }),
  duration: z.string().optional(),
  language: z.string().optional(),
  intake_period: z.string().optional(),
  scholarship_info: z.string().optional(),
  notes: z.string().optional(),
  is_manual: z.boolean().optional(),
});

const notesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("shortlisted_courses")
    .select("*")
    .eq("user_id", user.id)
    .order("qs_world_ranking", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = shortlistSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: z.prettifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("shortlisted_courses")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "This course is already on your shortlist." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = notesSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: z.prettifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { id, notes } = parsed.data;

  const { data, error } = await supabase
    .from("shortlisted_courses")
    .update({ notes })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("shortlisted_courses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
