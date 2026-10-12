import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAccess, ensureDocumentChecklist, wishlistAccess } from "@/lib/wishlist-access";

const BUCKET = "application-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"]);

const addSchema = z.object({
  courseId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  details: z.string().trim().max(300).optional(),
});

const clearSchema = z.object({
  id: z.string().uuid(),
  clearFile: z.literal(true),
});

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 80);
  return cleaned || "document";
}

async function loadDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string
) {
  const { data, error } = await supabase
    .from("application_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: course, error: courseError } = await supabase
    .from("shortlisted_courses")
    .select("user_id")
    .eq("id", data.course_id)
    .maybeSingle();
  if (courseError) throw new Error(courseError.message);
  if (!course) return null;
  return { document: data, ownerId: course.user_id };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const documentId = params.get("documentId");
  if (documentId) {
    let loaded: Awaited<ReturnType<typeof loadDocument>>;
    try {
      loaded = await loadDocument(supabase, documentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open the file";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    if (!loaded?.document.storage_path) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 404 });
    }
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(loaded.document.storage_path, 60);
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Could not open the file" }, { status: 500 });
    }
    return NextResponse.json({ url: data.signedUrl, fileName: loaded.document.file_name });
  }

  const courseId = params.get("courseId");
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  const { data: course, error: courseError } = await supabase
    .from("shortlisted_courses")
    .select("id, user_id, course_level, course_type, language, admission_requirements, scholarship_info")
    .eq("id", courseId)
    .maybeSingle();
  if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const access = await wishlistAccess(supabase, course.user_id, user.id, user.email);
  if (!access) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (assertAccess(access, "edit")) {
    try {
      await ensureDocumentChecklist(supabase, course);
    } catch (error) {
      console.error(error);
    }
  }

  const { data, error } = await supabase
    .from("application_documents")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const documentId = String(form.get("documentId") ?? "");
    const file = form.get("file");
    if (!z.string().uuid().safeParse(documentId).success || !(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file for this checklist item" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Files must be between 1 byte and 10 MB" }, { status: 400 });
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension) || (file.type && !ALLOWED_TYPES.has(file.type))) {
      return NextResponse.json(
        { error: "Upload a PDF, Word document, or JPEG, PNG, or WebP image" },
        { status: 400 }
      );
    }

    const loaded = await loadDocument(supabase, documentId);
    if (!loaded) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    const { document, ownerId } = loaded;
    const access = await wishlistAccess(supabase, ownerId, user.id, user.email);
    if (!assertAccess(access, "edit")) {
      return NextResponse.json({ error: "You cannot upload documents here" }, { status: 403 });
    }

    const path = `${ownerId}/${document.course_id}/${document.id}/${safeFileName(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    if (document.storage_path && document.storage_path !== path) {
      await supabase.storage.from(BUCKET).remove([document.storage_path]);
    }

    const { data, error } = await supabase
      .from("application_documents")
      .update({
        storage_path: path,
        file_name: safeFileName(file.name),
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document: data });
  }

  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { data: course, error: courseError } = await supabase
    .from("shortlisted_courses")
    .select("id, user_id")
    .eq("id", parsed.data.courseId)
    .maybeSingle();
  if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const access = await wishlistAccess(supabase, course.user_id, user.id, user.email);
  if (!assertAccess(access, "edit")) {
    return NextResponse.json({ error: "You cannot edit this checklist" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("application_documents")
    .insert({
      course_id: course.id,
      label: parsed.data.label,
      details: parsed.data.details ?? null,
      required: true,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That document is already on the checklist" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ document: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = clearSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const loaded = await loadDocument(supabase, parsed.data.id);
  if (!loaded) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  const { document } = loaded;
  const access = await wishlistAccess(supabase, loaded.ownerId, user.id, user.email);
  if (!assertAccess(access, "edit")) {
    return NextResponse.json({ error: "You cannot edit this checklist" }, { status: 403 });
  }
  if (document.storage_path) {
    await supabase.storage.from(BUCKET).remove([document.storage_path]);
  }
  const { data, error } = await supabase
    .from("application_documents")
    .update({
      storage_path: null,
      file_name: null,
      uploaded_by: null,
      uploaded_at: null,
    })
    .eq("id", document.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
