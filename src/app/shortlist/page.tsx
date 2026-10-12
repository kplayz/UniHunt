import { redirect } from "next/navigation";
import { ShortlistView } from "@/components/shortlist/shortlist-view";
import type { ShortlistAccess } from "@/lib/share-access";
import { createClient } from "@/lib/supabase/server";
import type { ShortlistShare, ShortlistedCourse } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ShortlistPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const { owner } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email?.toLowerCase() ?? "";
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from("shortlist_shares").select("*").eq("owner_id", user.id),
    email
      ? supabase.from("shortlist_shares").select("*").eq("invite_email", email)
      : Promise.resolve({ data: [] as ShortlistShare[] }),
  ]);

  const shared = (incoming ?? []) as ShortlistShare[];
  const viewingShared = Boolean(owner && UUID.test(owner) && owner !== user.id);
  const grant = viewingShared ? shared.find((share) => share.owner_id === owner) : undefined;
  if (viewingShared && !grant) {
    redirect("/shortlist");
  }

  const ownerId = viewingShared && owner ? owner : user.id;
  const { data, error } = await supabase
    .from("shortlisted_courses")
    .select("*")
    .eq("user_id", ownerId)
    .order("qs_world_ranking", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load wishlist: ${error.message}`);
  }

  const access: ShortlistAccess = grant ? (grant.permission as ShortlistAccess) : "owner";

  return (
    <ShortlistView
      userEmail={user.email ?? null}
      items={(data ?? []) as ShortlistedCourse[]}
      access={access}
      ownerEmail={grant?.owner_email ?? null}
      outgoing={(outgoing ?? []) as ShortlistShare[]}
      incoming={shared.filter((share) => share.owner_id !== user.id)}
    />
  );
}
