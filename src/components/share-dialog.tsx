"use client";

import { Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { initialsOf } from "@/components/current-user";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Person = { id: string; username: string; display_name: string };
type Role = "viewer" | "editor";
type Share = { user_id: string; role: Role };

/** Lets the owner choose who sees the story, and who can also edit it. Everyone sees changes live. */
export function ShareDialog({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [chosen, setChosen] = useState<Map<string, Role>>(new Map());
  const [sharedCount, setSharedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setOpen(true);
    setPeople(null);
    try {
      const [usersResponse, sharesResponse] = await Promise.all([fetch("/api/users"), fetch(`/api/stories/${storyId}/shares`)]);
      const users = await usersResponse.json();
      const shares = await sharesResponse.json();
      if (!usersResponse.ok || !sharesResponse.ok) throw new Error(users.error ?? shares.error);
      setPeople(users.users);
      setChosen(new Map((shares.shares as Share[]).map((share) => [share.user_id, share.role])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sharing could not be loaded.");
      setOpen(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/stories/${storyId}/shares`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shares: [...chosen].map(([userId, role]) => ({ userId, role })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const count = data.shares.length;
      setSharedCount(count);
      toast.success(count === 0 ? "This story is private again." : `Shared with ${count} ${count === 1 ? "person" : "people"}.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sharing could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const update = (id: string, role: Role | null) =>
    setChosen((current) => {
      const next = new Map(current);
      if (role) next.set(id, role);
      else next.delete(id);
      return next;
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={load}>
        <Share2 /> Share{sharedCount ? ` (${sharedCount})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share this story</DialogTitle>
            <DialogDescription>
              People you choose find it under &ldquo;Shared with me&rdquo;, with its sources and every version, and see changes live. Viewers can ask you for edit access. Only you can delete the story or change who it is shared with.
            </DialogDescription>
          </DialogHeader>
          {people === null ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">There is no one else yet. An admin can add users on the Users page.</p>
          ) : (
            <div className="space-y-1.5">
              {people.map((person) => {
                const role = chosen.get(person.id) ?? null;
                return (
                  <div
                    key={person.id}
                    className={cn("flex items-center gap-3 rounded-md border p-2.5 transition-colors", role && "border-primary bg-primary/8")}
                  >
                    <Checkbox
                      checked={role !== null}
                      onCheckedChange={(checked) => update(person.id, checked === true ? "viewer" : null)}
                      aria-label={`Share with ${person.display_name}`}
                    />
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">{initialsOf(person.display_name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{person.display_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
                    </span>
                    {role && (
                      <div className="flex shrink-0 gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="radiogroup" aria-label={`Access for ${person.display_name}`}>
                        {(["viewer", "editor"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={role === option}
                            onClick={() => update(person.id, option)}
                            className={cn("rounded px-2 py-1 font-medium transition-colors", role === option ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                          >
                            {option === "viewer" ? "Can view" : "Can edit"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button onClick={save} disabled={saving || people === null}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
