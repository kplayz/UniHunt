"use client";

import { useState } from "react";
import { Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sharePermissionLabel, SHARE_PERMISSIONS, type SharePermission } from "@/lib/share-access";
import type { ShortlistShare } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ShareWishlistDialogProps {
  outgoing: ShortlistShare[];
  onChange: () => void;
}

export function ShareWishlistDialog({ outgoing, onChange }: ShareWishlistDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("read");
  const [saving, setSaving] = useState(false);

  async function handleShare(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shortlist/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permission }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not share");
      setEmail("");
      toast.success(`Shared with ${email.trim().toLowerCase()}`);
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not share");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(share: ShortlistShare) {
    const res = await fetch("/api/shortlist/shares", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: share.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not remove access");
      return;
    }
    toast.success(`Removed ${share.invite_email}`);
    onChange();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share wishlist</DialogTitle>
          <DialogDescription>
            Invite a counselor, parent, or anyone else with an account. They sign in with this
            email to open your wishlist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleShare} className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="share-email">Email</Label>
            <Input
              id="share-email"
              type="email"
              required
              value={email}
              placeholder="counselor@school.edu"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Permission</Label>
            <Select
              value={permission}
              onValueChange={(value) => setPermission(value as SharePermission)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_PERMISSIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {sharePermissionLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              View only can read courses and files. Comment adds notes on each course. Edit can
              change the fit category, notes, dates, and uploads. Delete can also remove courses.
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Sharing…" : "Share wishlist"}
          </Button>
        </form>
        {outgoing.length > 0 && (
          <ul className="space-y-2 border-t pt-3">
            {outgoing.map((share) => (
              <li key={share.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{share.invite_email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {sharePermissionLabel(share.permission)}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${share.invite_email}`}
                  onClick={() => handleRevoke(share)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
