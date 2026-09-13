"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ShortlistInsert } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface AddManualDialogProps {
  onAdd: (item: ShortlistInsert) => Promise<void>;
}

const emptyForm: ShortlistInsert = {
  university_name: "",
  university_location: "",
  course_name: "",
  course_level: "",
  course_type: "",
  specialization: "",
  country: "",
  qs_world_ranking: null,
  tuition_fee: "",
  admission_requirements: "",
  course_url: "",
  duration: "",
  language: "",
  intake_period: "",
  scholarship_info: "",
  notes: "",
  is_manual: true,
};

export function AddManualDialog({ onAdd }: AddManualDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ShortlistInsert>(emptyForm);

  function update(field: keyof ShortlistInsert, value: string | number | null | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.university_name.trim() || !form.course_name.trim()) {
      toast.error("University name and course name are required");
      return;
    }

    setLoading(true);
    try {
      await onAdd(form);
      toast.success("Added to shortlist");
      setForm(emptyForm);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add course");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add manually
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add university manually</DialogTitle>
          <DialogDescription>
            Add a course you discovered outside the AI search results.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="uni-name">University Name *</Label>
              <Input
                id="uni-name"
                value={form.university_name}
                onChange={(e) => update("university_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="course-name">Course Name *</Label>
              <Input
                id="course-name"
                value={form.course_name}
                onChange={(e) => update("course_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.university_location ?? ""}
                onChange={(e) => update("university_location", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country ?? ""}
                onChange={(e) => update("country", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qs">QS World Ranking</Label>
              <Input
                id="qs"
                type="number"
                value={form.qs_world_ranking ?? ""}
                onChange={(e) =>
                  update(
                    "qs_world_ranking",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tuition">Tuition Fee</Label>
              <Input
                id="tuition"
                value={form.tuition_fee ?? ""}
                onChange={(e) => update("tuition_fee", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                placeholder="e.g. 4 years"
                value={form.duration ?? ""}
                onChange={(e) => update("duration", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                placeholder="e.g. English"
                value={form.language ?? ""}
                onChange={(e) => update("language", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake">Intake Period</Label>
              <Input
                id="intake"
                placeholder="e.g. Fall 2026"
                value={form.intake_period ?? ""}
                onChange={(e) => update("intake_period", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scholarship">Scholarships</Label>
              <Input
                id="scholarship"
                value={form.scholarship_info ?? ""}
                onChange={(e) => update("scholarship_info", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="url">Course URL</Label>
              <Input
                id="url"
                type="url"
                value={form.course_url ?? ""}
                onChange={(e) => update("course_url", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="requirements">Admission Requirements</Label>
              <Textarea
                id="requirements"
                value={form.admission_requirements ?? ""}
                onChange={(e) => update("admission_requirements", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add to shortlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
