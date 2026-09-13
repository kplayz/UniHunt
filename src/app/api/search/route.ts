import { NextResponse } from "next/server";
import { z } from "zod";
import { searchUniversityCourses } from "@/lib/huggingface";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const searchSchema = z.object({
  courseLevel: z.string(),
  courseType: z.string(),
  specialization: z.string(),
  countries: z.array(z.string()),
  candidateType: z.string(),
  lastQualification: z.string(),
  lastSchool: z.string(),
  curriculum: z.string(),
  subjects: z.string(),
  grades: z.string(),
  budgetMax: z.string(),
  additionalNotes: z.string(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = searchSchema.safeParse(
      await request.json().catch(() => null)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const criteria = parsed.data;
    const results = await searchUniversityCourses(criteria);

    await supabase.from("search_sessions").insert({
      user_id: user.id,
      criteria: criteria as Json,
      results: results as unknown as Json,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
