import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDocumentChecklist } from "./document-checklist";
import type { Database } from "./supabase/database.types";
import {
  permissionAllows,
  type SharePermission,
  type ShortlistAccess,
} from "./share-access";

type Client = SupabaseClient<Database>;

const PERMISSIONS = new Set<SharePermission>(["read", "comment", "edit", "delete"]);

export async function wishlistAccess(
  supabase: Client,
  ownerId: string,
  userId: string,
  email: string | null | undefined
): Promise<ShortlistAccess | null> {
  if (ownerId === userId) return "owner";
  const invite = email?.trim().toLowerCase();
  if (!invite) return null;
  const { data, error } = await supabase
    .from("shortlist_shares")
    .select("permission")
    .eq("owner_id", ownerId)
    .eq("invite_email", invite)
    .maybeSingle();
  if (error || !data) return null;
  return PERMISSIONS.has(data.permission as SharePermission)
    ? (data.permission as SharePermission)
    : null;
}

export function assertAccess(
  access: ShortlistAccess | null,
  required: SharePermission
): access is ShortlistAccess {
  return permissionAllows(access, required);
}

export async function ensureDocumentChecklist(
  supabase: Client,
  course: {
    id: string;
    course_level: string | null;
    course_type: string | null;
    language: string | null;
    admission_requirements: string | null;
    scholarship_info: string | null;
  }
) {
  const { count, error: countError } = await supabase
    .from("application_documents")
    .select("id", { count: "exact", head: true })
    .eq("course_id", course.id);
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const items = buildDocumentChecklist({
    courseLevel: course.course_level,
    courseType: course.course_type,
    language: course.language,
    admissionRequirements: course.admission_requirements,
    scholarshipInfo: course.scholarship_info,
  });
  const { error } = await supabase.from("application_documents").insert(
    items.map((item) => ({
      course_id: course.id,
      label: item.label,
      details: item.details,
      required: item.required,
    }))
  );
  if (error && error.code !== "23505") throw new Error(error.message);
}
