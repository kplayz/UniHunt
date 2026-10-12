"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { AddManualDialog } from "@/components/shortlist/add-manual-dialog";
import { ShareWishlistDialog } from "@/components/shortlist/share-wishlist-dialog";
import { ShortlistTable } from "@/components/shortlist/shortlist-table";
import type { FitCategory } from "@/lib/candidate-fit";
import { permissionAllows, sharePermissionLabel, type ShortlistAccess } from "@/lib/share-access";
import type { ShortlistInsert, ShortlistShare, ShortlistedCourse } from "@/lib/types";

interface ShortlistViewProps {
  userEmail: string | null;
  items: ShortlistedCourse[];
  access: ShortlistAccess;
  ownerEmail: string | null;
  outgoing: ShortlistShare[];
  incoming: ShortlistShare[];
}

export function ShortlistView({
  userEmail,
  items,
  access,
  ownerEmail,
  outgoing,
  incoming,
}: ShortlistViewProps) {
  const router = useRouter();

  async function handleAdd(item: ShortlistInsert) {
    const res = await fetch("/api/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to add");
    }
    router.refresh();
  }

  async function handleSaveNotes(id: string, notes: string) {
    const res = await fetch("/api/shortlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, notes }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to save notes");
    }
    router.refresh();
  }

  async function handleLookupDates(id: string) {
    const res = await fetch("/api/shortlist/important-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to find important dates");
    }
    router.refresh();
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/shortlist?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove course");
      return;
    }
    toast.success("Removed from wishlist");
    router.refresh();
  }

  async function handleSetFit(id: string, fit: FitCategory) {
    const res = await fetch("/api/shortlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fit }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not update the category");
      return;
    }
    toast.success("Category updated");
    router.refresh();
  }

  const canEdit = permissionAllows(access, "edit");
  const canComment = permissionAllows(access, "comment");
  const canDelete = permissionAllows(access, "delete");
  const isOwner = access === "owner";

  return (
    <div className="min-h-full bg-muted/20">
      <AppHeader userEmail={userEmail} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isOwner ? "Wishlist" : `Wishlist shared by ${ownerEmail ?? "another user"}`}
            </h1>
            <p className="text-muted-foreground">
              {isOwner
                ? "Saved courses, labelled Dream, Reach, or Target from your search profile."
                : `You can ${sharePermissionLabel(access).toLowerCase()}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && <ShareWishlistDialog outgoing={outgoing} onChange={() => router.refresh()} />}
            {canEdit && <AddManualDialog onAdd={handleAdd} />}
          </div>
        </div>
        {isOwner && incoming.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">Shared with you</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {incoming.map((share) => (
                <li key={share.id}>
                  <Link
                    href={`/shortlist?owner=${share.owner_id}`}
                    className="inline-flex rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {share.owner_email}
                    <span className="ml-2 text-muted-foreground">
                      {sharePermissionLabel(share.permission)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!isOwner && (
          <Link href="/shortlist" className="text-sm text-primary hover:underline">
            Back to your wishlist
          </Link>
        )}
        <ShortlistTable
          items={items}
          onRemove={handleRemove}
          onSaveNotes={handleSaveNotes}
          onLookupDates={handleLookupDates}
          onSetFit={handleSetFit}
          canEdit={canEdit}
          canComment={canComment}
          canDelete={canDelete}
        />
      </main>
    </div>
  );
}
