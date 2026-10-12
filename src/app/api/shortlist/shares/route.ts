import { NextResponse } from "next/server";
import { z } from "zod";
import { SHARE_PERMISSIONS } from "@/lib/share-access";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  email: z.string().trim().email().max(200),
  permission: z.enum(SHARE_PERMISSIONS),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = user.email?.toLowerCase() ?? "";
  const [{ data: outgoing, error: outError }, { data: incoming, error: inError }] =
    await Promise.all([
      supabase
        .from("shortlist_shares")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      email
        ? supabase
            .from("shortlist_shares")
            .select("*")
            .eq("invite_email", email)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (outError || inError) {
    return NextResponse.json(
      { error: outError?.message ?? inError?.message ?? "Could not load shares" },
      { status: 500 }
    );
  }

  return NextResponse.json({ outgoing: outgoing ?? [], incoming: incoming ?? [] });
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

  const invite = parsed.data.email.toLowerCase();
  if (invite === user.email.toLowerCase()) {
    return NextResponse.json({ error: "You cannot share a wishlist with yourself" }, { status: 400 });
  }

  const { count } = await supabase
    .from("shortlist_shares")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) >= 20) {
    return NextResponse.json({ error: "You can share with at most 20 people" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shortlist_shares")
    .upsert(
      {
        owner_id: user.id,
        owner_email: user.email.toLowerCase(),
        invite_email: invite,
        permission: parsed.data.permission,
      },
      { onConflict: "owner_id,invite_email" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ share: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const { error } = await supabase
    .from("shortlist_shares")
    .delete()
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
