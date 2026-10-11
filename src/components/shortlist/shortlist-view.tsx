"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { AddManualDialog } from "@/components/shortlist/add-manual-dialog";
import { ShortlistTable } from "@/components/shortlist/shortlist-table";
import type { ShortlistInsert, ShortlistedCourse } from "@/lib/types";

interface ShortlistViewProps {
  userEmail: string | null;
  items: ShortlistedCourse[];
}

export function ShortlistView({ userEmail, items }: ShortlistViewProps) {
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
    toast.success("Removed from shortlist");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-muted/20">
      <AppHeader userEmail={userEmail} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shortlisted Courses</h1>
            <p className="text-muted-foreground">
              Your saved universities and courses, stored securely in your account.
            </p>
          </div>
          <AddManualDialog onAdd={handleAdd} />
        </div>
        <ShortlistTable
          items={items}
          onRemove={handleRemove}
          onSaveNotes={handleSaveNotes}
          onLookupDates={handleLookupDates}
        />
      </main>
    </div>
  );
}
