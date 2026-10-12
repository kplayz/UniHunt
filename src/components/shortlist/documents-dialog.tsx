"use client";

import { useState } from "react";
import { ExternalLink, FileUp, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ApplicationDocument } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DocumentsDialogProps {
  courseId: string;
  courseName: string;
  canEdit: boolean;
}

export function DocumentsDialog({ courseId, courseName, canEdit }: DocumentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/shortlist/documents?courseId=${courseId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load documents");
      setDocuments(data.documents ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function upload(documentId: string, file: File | undefined) {
    if (!file) return;
    setUploadingId(documentId);
    try {
      const body = new FormData();
      body.set("documentId", documentId);
      body.set("file", file);
      const res = await fetch("/api/shortlist/documents", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setDocuments((current) =>
        current.map((item) => (item.id === data.document.id ? data.document : item))
      );
      toast.success("Document uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  async function openFile(documentId: string) {
    const res = await fetch(`/api/shortlist/documents?documentId=${documentId}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not open the file");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function clearFile(documentId: string) {
    const res = await fetch("/api/shortlist/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: documentId, clearFile: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not remove the file");
      return;
    }
    setDocuments((current) =>
      current.map((item) => (item.id === data.document.id ? data.document : item))
    );
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/shortlist/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, label }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not add the document");
      return;
    }
    setDocuments((current) => [...current, data.document]);
    setLabel("");
  }

  const uploaded = documents.filter((item) => item.storage_path).length;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Application documents for ${courseName}`}>
          <FolderOpen className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Application documents</DialogTitle>
          <DialogDescription>
            {courseName}. {uploaded} of {documents.length || "…"} uploaded.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading checklist…
          </div>
        ) : (
          <ul className="space-y-3">
            {documents.map((item) => (
              <li key={item.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Badge variant={item.required ? "secondary" : "outline"}>
                    {item.required ? "Required" : "Optional"}
                  </Badge>
                  {item.file_name && <Badge variant="outline">Uploaded</Badge>}
                </div>
                {item.details && <p className="mt-1 text-xs text-muted-foreground">{item.details}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.file_name && (
                    <Button variant="link" size="sm" className="h-auto px-0" onClick={() => openFile(item.id)}>
                      {item.file_name}
                      <ExternalLink className="size-3" />
                    </Button>
                  )}
                  {canEdit && (
                    <>
                      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline">
                        <FileUp className="size-3" />
                        {uploadingId === item.id ? "Uploading…" : item.file_name ? "Replace" : "Upload"}
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp"
                          disabled={uploadingId === item.id}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            void upload(item.id, file);
                          }}
                        />
                      </label>
                      {item.file_name && (
                        <Button variant="ghost" size="sm" onClick={() => clearFile(item.id)}>
                          Remove file
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canEdit && !loading && (
          <form onSubmit={addItem} className="flex gap-2 border-t pt-3">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Add another document"
              maxLength={120}
              required
            />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
