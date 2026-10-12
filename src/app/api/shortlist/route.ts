import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyCourseFit } from "@/lib/candidate-fit";
import { createClient } from "@/lib/supabase/server";
import { isHttpUrl } from "@/lib/url";
import { assertAccess, ensureDocumentChecklist, wishlistAccess } from "@/lib/wishlist-access";

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
  fit: z.enum(["dream", "reach", "target"]).optional(),
  fit_reason: z.string().max(500).optional(),
  fit_source: z.enum(["auto", "manual"]).optional(),
  is_manual: z.boolean().optional(),
});

const patchSchema = z
  .object({
    id: z.string().uuid(),
    notes: z.string().max(2000).optional(),
    fit: z.enum(["dream", "reach", "target"]).optional(),
  })
  .refine((value) => value.notes !== undefined || value.fit !== undefined, {
    message: "Nothing to update",
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

  const labelled = parsed.data.fit
    ? null
    : classifyCourseFit(
        {
          universityName: parsed.data.university_name,
          courseName: parsed.data.course_name,
          courseLevel: parsed.data.course_level ?? "",
          specialization: parsed.data.specialization ?? "",
          qsWorldRanking: parsed.data.qs_world_ranking ?? null,
          tuitionFee: parsed.data.tuition_fee ?? "",
          admissionRequirements: parsed.data.admission_requirements ?? "",
          courseUrl: parsed.data.course_url ?? "",
          scholarshipInfo: parsed.data.scholarship_info ?? "",
        },
        {
          courseLevel: parsed.data.course_level ?? "",
          courseType: parsed.data.course_type ?? "",
          specialization: parsed.data.specialization ?? "",
          countries: parsed.data.country ? [parsed.data.country] : [],
          candidateType: "",
          lastQualification: "",
          lastSchool: "",
          curriculum: "",
          subjects: "",
          grades: "",
          budgetMax: "",
          additionalNotes: "",
        }
      );

  const { data, error } = await supabase
    .from("shortlisted_courses")
    .insert({
      ...parsed.data,
      fit: parsed.data.fit ?? labelled?.fit,
      fit_reason: parsed.data.fit_reason ?? labelled?.fitReason,
      fit_source: parsed.data.fit ? parsed.data.fit_source ?? "auto" : "auto",
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "This course is already on your wishlist." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await ensureDocumentChecklist(supabase, data);
  } catch (checklistError) {
    console.error("Checklist seed failed:", checklistError);
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

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: z.prettifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { id, notes, fit } = parsed.data;
  const { data: existing, error: loadError } = await supabase
    .from("shortlisted_courses")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const access = await wishlistAccess(supabase, existing.user_id, user.id, user.email);
  if (!assertAccess(access, "edit")) {
    return NextResponse.json({ error: "You cannot edit this wishlist" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("shortlisted_courses")
    .update({
      ...(notes !== undefined ? { notes } : {}),
      ...(fit !== undefined ? { fit, fit_source: "manual" as const } : {}),
    })
    .eq("id", id)
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

  const { data: existing, error: loadError } = await supabase
    .from("shortlisted_courses")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const access = await wishlistAccess(supabase, existing.user_id, user.id, user.email);
  if (!assertAccess(access, "delete")) {
    return NextResponse.json({ error: "You cannot delete courses from this wishlist" }, { status: 403 });
  }

  const { error } = await supabase.from("shortlisted_courses").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
