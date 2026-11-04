"use client";

import { AlertTriangle, Globe, Link2, Link2Off, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Version } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PublicMode = "article" | "article_with_original";

const MODES: { id: PublicMode; title: string; text: string }[] = [
  { id: "article", title: "The article only", text: "Readers see your version, its source list and the passage behind each sentence." },
  {
    id: "article_with_original",
    title: "The article and the original news",
    text: "Readers also see the full original article text beside it.",
  },
];

function ModePicker({ mode, onChange }: { mode: PublicMode; onChange: (mode: PublicMode) => void }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="What to publish">
      {MODES.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={mode === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex w-full flex-col rounded-lg border p-3 text-left transition-colors",
            mode === option.id ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "hover:border-primary/40",
          )}
        >
          <span className="text-sm font-semibold">{option.title}</span>
          <span className="text-xs text-muted-foreground">{option.text}</span>
        </button>
      ))}
      {mode === "article_with_original" && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            This republishes the news outlet&apos;s full article on a public page. Their text is copyrighted, so only do this if you have their permission or another legal basis.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Public links need an admin. Admins publish directly and choose what is shown.
 * Owners and editors send a request instead. The owner or an admin can turn a link off.
 */
export function PublicLinkControl({
  version,
  approved,
  isAdmin,
  canEdit,
  canTurnOff,
  requested,
  onChange,
  onRequested,
}: {
  version: Version;
  approved: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canTurnOff: boolean;
  requested: boolean;
  onChange: (version: Version) => void;
  onRequested: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PublicMode>("article");
  const [saving, setSaving] = useState(false);

  const send = async (url: string, body: object) => {
    setSaving(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    const data = await send(`/api/versions/${version.id}/share`, { enabled: true, mode });
    if (!data) return;
    onChange(data.version);
    setOpen(false);
    await navigator.clipboard
      ?.writeText(`${window.location.origin}/s/${data.version.share_token}`)
      .then(() => toast.success("Public link created and copied."))
      .catch(() => toast.success("Public link created."));
  };

  const request = async () => {
    const data = await send("/api/requests", { kind: "publish", versionId: version.id, mode });
    if (!data) return;
    onRequested();
    setOpen(false);
    toast.success("Request sent. An admin can approve it from their Requests page.");
  };

  const turnOff = async () => {
    const data = await send(`/api/versions/${version.id}/share`, { enabled: false });
    if (!data) return;
    onChange(data.version);
    toast.success("Public link turned off.");
  };

  if (version.share_token) {
    return canTurnOff ? (
      <Button variant="outline" size="sm" onClick={turnOff} disabled={saving}>
        <Link2Off /> Turn off public link
      </Button>
    ) : null;
  }
  if (!isAdmin && !canEdit) return null;
  if (!isAdmin && requested) {
    return (
      <Button variant="outline" size="sm" disabled title="Waiting for an admin to answer">
        <Send /> Public link requested
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!approved || saving} title={approved ? undefined : "Approve this version first"}>
        {isAdmin ? <Link2 /> : <Globe />} {isAdmin ? "Publish link" : "Request public link"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAdmin ? "Publish a public link" : "Ask an admin to publish"}</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Anyone with the link can read it without signing in. You can turn it off at any time."
                : "Public links need an admin's permission. Choose what you would like published, and an admin will decide."}
            </DialogDescription>
          </DialogHeader>
          <ModePicker mode={mode} onChange={setMode} />
          <DialogFooter>
            <Button onClick={isAdmin ? publish : request} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} {isAdmin ? "Publish link" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
