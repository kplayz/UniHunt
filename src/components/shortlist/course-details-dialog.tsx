"use client";

import { useState } from "react";
import { ExternalLink, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import type { ShortlistComment, ShortlistedCourse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CourseDetailsDialogProps {
  course: ShortlistedCourse;
  onSaveNotes: (id: string, notes: string) => Promise<void>;
  canEdit?: boolean;
  canComment?: boolean;
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm whitespace-pre-wrap break-words">
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}

export function CourseDetailsDialog({
  course,
  onSaveNotes,
  canEdit = true,
  canComment = true,
}: CourseDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(course.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<ShortlistComment[]>([]);
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  // Reset on open rather than in an effect, so the textarea always reflects the
  // latest saved notes without triggering a cascading render.
  function handleOpenChange(next: boolean) {
    if (next) {
      setNotes(course.notes ?? "");
      void fetch(`/api/shortlist/comments?courseId=${course.id}`)
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) setComments(data.comments ?? []);
        })
        .catch(() => undefined);
    }
    setOpen(next);
  }

  async function handleComment(event: React.FormEvent) {
    event.preventDefault();
    setCommenting(true);
    try {
      const res = await fetch("/api/shortlist/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, body: comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the comment");
      setComments((current) => [...current, data.comment]);
      setComment("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the comment");
    } finally {
      setCommenting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveNotes(course.id, notes);
      toast.success("Notes saved");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={course.notes?.trim() ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={`Details and notes for ${course.course_name}`}
        >
          <NotebookPen className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{course.course_name}</DialogTitle>
          <DialogDescription>
            {course.university_name}
            {course.university_location ? ` — ${course.university_location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y">
          <DetailRow label="Level" value={course.course_level} />
          <DetailRow label="Type" value={course.course_type} />
          <DetailRow label="Specialization" value={course.specialization} />
          <DetailRow label="Country" value={course.country} />
          <DetailRow
            label="QS Ranking"
            value={course.qs_world_ranking?.toString() ?? null}
          />
          <DetailRow label="Tuition" value={course.tuition_fee} />
          <DetailRow label="Duration" value={course.duration} />
          <DetailRow label="Language" value={course.language} />
          <DetailRow label="Intake" value={course.intake_period} />
          <DetailRow label="Scholarships" value={course.scholarship_info} />
          <DetailRow label="Requirements" value={course.admission_requirements} />
          <DetailRow label="Why this fit" value={course.fit_reason} />
        </dl>

        {course.course_url && (
          <a
            href={course.course_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Official course page
            <ExternalLink className="size-3" />
          </a>
        )}

        <div className="space-y-2">
          <Label htmlFor={`notes-${course.id}`}>Your notes</Label>
          <Textarea
            id={`notes-${course.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={!canEdit}
            placeholder="Deadlines, contacts, why this one appeals to you…"
          />
        </div>

        <div className="space-y-2">
          <Label>Comments</Label>
          <ul className="space-y-2">
            {comments.map((item) => (
              <li key={item.id} className="rounded-md bg-muted/50 p-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  {item.author_email} · {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap break-words">{item.body}</p>
              </li>
            ))}
            {comments.length === 0 && (
              <li className="text-xs text-muted-foreground">No comments yet.</li>
            )}
          </ul>
          {canComment && (
            <form onSubmit={handleComment} className="space-y-2">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Leave a note for the applicant"
                required
              />
              <Button type="submit" variant="secondary" disabled={commenting}>
                {commenting ? "Posting…" : "Add comment"}
              </Button>
            </form>
          )}
        </div>

        {canEdit && (
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save notes"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
