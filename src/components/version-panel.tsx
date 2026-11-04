"use client";

import { motion } from "motion/react";
import {
  Check,
  Columns2,
  Copy,
  Download,
  FileSearch,
  Languages,
  ListChecks,
  Loader2,
  Newspaper,
  Pencil,
  Percent,
  ShieldAlert,
  SpellCheck,
  Trash2,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ArticleView } from "@/components/article-view";
import { EvidencePanel } from "@/components/evidence-panel";
import { OriginalPane } from "@/components/original-pane";
import { PublicLinkControl } from "@/components/public-link-control";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { allSentences, articleAsText } from "@/lib/evidence";
import { useCurrentUser } from "@/components/current-user";
import { findOutletNames } from "@/lib/outlet-names";
import type { Source, Version } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEW_KEY = "newsgen-version-view";

function readView(): "compare" | "evidence" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "evidence" ? "evidence" : "compare";
  } catch {
    return "compare";
  }
}

function subscribeView(onChange: () => void) {
  window.addEventListener(VIEW_KEY, onChange);
  return () => window.removeEventListener(VIEW_KEY, onChange);
}

async function patchVersion(id: string, body: object): Promise<Version> {
  const response = await fetch(`/api/versions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data.version;
}

/** A Gemini action in progress. Only one runs at a time, so results never overwrite each other or open unexpectedly. */
export type AiTask = {
  versionId: string;
  kind: "proofread" | "translate" | "outlets" | "edit";
  message: string;
};

export function VersionPanel({
  version,
  sources,
  storyIsFull,
  readOnly = false,
  storyAccess,
  publishRequested,
  onPublishRequested,
  task,
  onTaskChange,
  onChange,
  onDelete,
  onTranslated,
}: {
  version: Version;
  sources: Source[];
  storyIsFull: boolean;
  readOnly?: boolean;
  storyAccess: "own" | "edit" | "view";
  publishRequested: boolean;
  onPublishRequested: () => void;
  task: AiTask | null;
  onTaskChange: (task: AiTask | null) => void;
  onChange: (version: Version) => void;
  onDelete: (id: string) => void;
  onTranslated: (version: Version) => void;
}) {
  // Empty on the server, so the first render matches and the link appears once the page has loaded.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Saved per browser. The server always renders side by side, so the first render matches.
  const view = useSyncExternalStore(subscribeView, readView, () => "compare" as const);
  const chooseView = (next: "compare" | "evidence") => {
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The choice is only a convenience, so it is fine if it cannot be kept.
    }
    window.dispatchEvent(new Event(VIEW_KEY));
  };
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const currentUser = useCurrentUser();
  const [byline, setByline] = useState(version.byline ?? currentUser.display_name);
  const [acknowledged, setAcknowledged] = useState(false);

  const { content, review } = version;
  const sentences = allSentences(content);
  const selected = sentences.find((s) => s.id === selectedId) ?? null;
  const flaggedIds = new Set(review.flags.flatMap((f) => (f.sentenceId ? [f.sentenceId] : [])));
  const storyFlags = review.flags.filter((f) => f.sentenceId === null);
  const highFlags = review.flags.filter((f) => f.severity === "high").length;
  const blockers = sentences.filter((s) => {
    const r = review.sentences[s.id];
    return !r || r.verdict === "unsupported" || r.unverifiedQuotes.length > 0;
  });
  const attention = sentences.filter((s) => {
    const r = review.sentences[s.id];
    return r && (r.verdict === "partial" || r.unmatchedNumbers.length > 0 || r.copiedPhrase !== null);
  });
  const namedOutlets = [...new Set(sentences.flatMap((s) => findOutletNames(s.text)))];
  const approved = version.status === "reviewed";
  const shareUrl = version.share_token && origin ? `${origin}/s/${version.share_token}` : null;

  const busy = task !== null;
  const running = (kind: AiTask["kind"]) => task?.kind === kind && task.versionId === version.id;
  const proofreading = running("proofread");
  const removingOutlets = running("outlets");
  const translating = running("translate");
  const startTask = (kind: AiTask["kind"], message: string) => onTaskChange({ versionId: version.id, kind, message });

  const select = (id: string) => {
    setSelectedId(id);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!selected || draft === null) return;
    setSaving(true);
    startTask("edit", `Re-checking "${version.label}"`);
    try {
      onChange(
        await patchVersion(version.id, {
          action: "edit",
          sentenceId: selected.id,
          text: draft,
        }),
      );
      setDraft(null);
      toast.success(draft.trim() ? "Saved and re-checked." : "Sentence removed and version re-checked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The edit could not be saved.");
    } finally {
      onTaskChange(null);
      setSaving(false);
    }
  };

  const targetLanguage = version.language === "Filipino" ? "English" : "Filipino";

  const translate = async () => {
    startTask("translate", `Translating "${version.label}" to ${targetLanguage}`);
    try {
      const response = await fetch(`/api/versions/${version.id}/translate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: targetLanguage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`${targetLanguage} version created and opened. "${version.label}" is unchanged.`);
      onTranslated(data.version);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The version could not be translated.");
    } finally {
      onTaskChange(null);
    }
  };

  const removeOutlets = async () => {
    startTask("outlets", `Removing outlet names from "${version.label}"`);
    try {
      const updated = await patchVersion(version.id, {
        action: "remove-outlets",
      });
      onChange(updated);
      const left = allSentences(updated.content).flatMap((s) => findOutletNames(s.text));
      if (left.length === 0) toast.success("Outlet names removed. The version was re-checked.");
      else
        toast.warning(
          `Still named: ${[...new Set(left)].join(", ")}. Gemini kept these, possibly because the outlet is part of the news. Edit them if not.`,
        );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The outlet names could not be removed.");
    } finally {
      onTaskChange(null);
    }
  };

  const runProofread = async () => {
    const before = review.proofreadChanges.length;
    startTask("proofread", `Proofreading "${version.label}"`);
    try {
      const updated = await patchVersion(version.id, { action: "proofread" });
      onChange(updated);
      const fixes = updated.review.proofreadChanges.length - before;
      if (fixes === 0) toast.success(`Proofread finished on "${version.label}". No corrections were needed.`);
      else
        toast.success(
          `Proofread finished on "${version.label}" with ${fixes} ${fixes === 1 ? "correction" : "corrections"}. It was re-checked.`,
        );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The proofread could not be completed.");
    } finally {
      onTaskChange(null);
    }
  };

  const approve = async () => {
    setSaving(true);
    try {
      onChange(
        await patchVersion(version.id, {
          action: "approve",
          byline,
          acknowledged: true,
        }),
      );
      setApproveOpen(false);
      setAcknowledged(false);
      toast.success("Approved. You can now download the PDF or create a link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The version could not be approved.");
    } finally {
      setSaving(false);
    }
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(articleAsText(content, version.byline, sources, version.language));
    toast.success("Article and source links copied.");
  };

  const remove = async () => {
    const response = await fetch(`/api/versions/${version.id}`, {
      method: "DELETE",
    });
    if (response.ok) onDelete(version.id);
    else toast.error("The version could not be deleted.");
  };

  const editor = selected && !readOnly && (
    <div className="rounded-lg border p-3">
      {draft === null ? (
        <Button variant="outline" size="sm" onClick={() => setDraft(selected.text)}>
          <Pencil /> Edit this sentence
        </Button>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="sentence-edit">Edit sentence</Label>
          <Textarea id="sentence-edit" rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} />
          <p className="text-xs text-muted-foreground">
            Saving re-runs every check
            {approved ? " and returns this version to review" : ""}. Leave it empty to remove the sentence.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={saving || busy}>
              {saving && <Loader2 className="animate-spin" />} Save and re-check
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/70 p-2 backdrop-blur">
        <motion.span
          key={version.status}
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
        >
          <Badge variant={approved ? "default" : "outline"}>
            {approved ? "Approved" : readOnly ? "Not approved yet" : "Needs your review"}
          </Badge>
        </motion.span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={copyText}>
          <Copy /> Copy
        </Button>
        {!readOnly && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={translate}
              disabled={busy || storyIsFull}
              title={storyIsFull ? "This story has 5 versions. Delete one to make room for the translation." : undefined}
            >
              {translating ? <Loader2 className="animate-spin" /> : <Languages />}
              {translating ? "Translating" : `Translate to ${targetLanguage}`}
            </Button>
            <Button variant="outline" size="sm" onClick={runProofread} disabled={busy || saving}>
              {proofreading ? <Loader2 className="animate-spin" /> : <SpellCheck />}
              {proofreading ? "Proofreading" : "Proofread"}
            </Button>
            <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
              <DialogTrigger render={<Button size="sm" disabled={blockers.length > 0 || approved || busy} />}>
                <Check /> {approved ? "Approved" : "Approve"}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve this version</DialogTitle>
                  <DialogDescription>
                    The checks reduce risk, but they are not legal clearance. The final call on publishing is yours.
                  </DialogDescription>
                </DialogHeader>
                {review.flags.length > 0 && (
                  <Alert variant="destructive">
                    <ShieldAlert />
                    <AlertTitle>
                      {review.flags.length} legal {review.flags.length === 1 ? "flag" : "flags"} still on this version
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {review.flags.map((flag) => (
                          <li key={`${flag.type}-${flag.explanation}`}>{flag.explanation}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="byline">Byline</Label>
                  <Input id="byline" value={byline} onChange={(event) => setByline(event.target.value)} placeholder="Your name" />
                </div>
                <Label className="items-start gap-2.5 font-normal">
                  <Checkbox checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked === true)} className="mt-0.5" />
                  <span>I read this version against its sources, and I take responsibility for what is published under my byline.</span>
                </Label>
                <DialogFooter>
                  <Button onClick={approve} disabled={!acknowledged || !byline.trim() || saving}>
                    {saving && <Loader2 className="animate-spin" />} Approve
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        {approved ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/versions/${version.id}/pdf`} />}>
            <Download /> PDF
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled title="Approve this version first">
            <Download /> PDF
          </Button>
        )}
        <PublicLinkControl
          version={version}
          approved={approved}
          isAdmin={currentUser.role === "admin"}
          canEdit={!readOnly}
          canTurnOff={storyAccess === "own" || currentUser.role === "admin"}
          requested={publishRequested}
          onChange={onChange}
          onRequested={onPublishRequested}
        />
        {!readOnly && (
          <>
            <Dialog>
              <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete version" />}>
                <Trash2 />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this version?</DialogTitle>
                  <DialogDescription>This also turns off its shared link. The story and its sources stay.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={remove}>
                    Delete version
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {shareUrl && (
        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          {approved ? (
            <>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium break-all text-primary underline-offset-2 hover:underline"
              >
                {shareUrl}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                Public link · {version.public_mode === "article_with_original" ? "article and original news" : "article only"}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">This public link is paused until the edited version is approved again.</p>
          )}
        </div>
      )}

      {blockers.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Fix before approving</AlertTitle>
          <AlertDescription>
            {blockers.length} {blockers.length === 1 ? "sentence is" : "sentences are"} not backed by the sources or{" "}
            {blockers.length === 1 ? "has" : "have"} an unverified quotation. Select the underlined text to edit or remove it.
          </AlertDescription>
        </Alert>
      )}
      {namedOutlets.length > 0 && !readOnly && (
        <Alert>
          <Newspaper />
          <AlertTitle>The article names a news outlet: {namedOutlets.join(", ")}</AlertTitle>
          <AlertDescription>
            <p>
              Outlets belong in the source list at the bottom, not in the article. Keep a name only if the outlet is part of the news
              itself.
            </p>
            <Button size="sm" className="mt-2" onClick={removeOutlets} disabled={busy || saving}>
              {removingOutlets && <Loader2 className="animate-spin" />} {removingOutlets ? "Removing names" : "Remove outlet names"}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {review.notices.map((notice) => (
        <Alert key={notice}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ))}
      {storyFlags.map((flag) => (
        <Alert key={`${flag.type}-${flag.explanation}`} variant="destructive">
          <ShieldAlert />
          <AlertTitle>Legal risk: {flag.type.replaceAll("_", " ")}</AlertTitle>
          <AlertDescription>
            {flag.explanation} {flag.suggestion}
          </AlertDescription>
        </Alert>
      ))}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={ListChecks} label="Sentences to check" value={attention.length + blockers.length} />
        <StatCard icon={ShieldAlert} label="High legal flags" value={highFlags} />
        <StatCard icon={Percent} label="Wording shared with sources" value={review.overlapPercent} suffix="%" />
        <StatCard icon={SpellCheck} label="Proofreading fixes" value={review.proofreadAt ? review.proofreadChanges.length : "Not run"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="Layout">
          {(
            [
              { id: "compare", label: "Side by side", icon: Columns2 },
              { id: "evidence", label: "Evidence", icon: FileSearch },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={view === option.id}
              onClick={() => chooseView(option.id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === option.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {view === option.id && (
                <motion.span
                  layoutId="layout-pill"
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <option.icon className="relative size-3.5" />
              <span className="relative">{option.label}</span>
            </button>
          ))}
        </div>
        {view === "compare" && <p className="text-xs text-muted-foreground">Your version on the left, the original on the right.</p>}
      </div>

      <div className={cn("grid gap-5", view === "compare" ? "xl:grid-cols-2" : "xl:grid-cols-[minmax(0,1fr)_24rem]")}>
        <div className="min-w-0 rounded-lg border bg-card/70 p-5 backdrop-blur sm:p-7">
          <ArticleView
            content={content}
            byline={version.byline}
            wordCount={version.word_count}
            selectedId={selectedId}
            onSelect={select}
            reviews={review.sentences}
            flaggedIds={flaggedIds}
            sources={sources}
            language={version.language}
          />
          {review.proofreadChanges.length > 0 && (
            <details className="mt-6 text-sm">
              <summary className="cursor-pointer font-medium">Proofreading log ({review.proofreadChanges.length})</summary>
              <ul className="mt-2 space-y-3">
                {review.proofreadChanges.map((change) => (
                  <li key={change.before} className="border-l-2 pl-3">
                    <p className="text-muted-foreground line-through">{change.before}</p>
                    <p>{change.after}</p>
                    <p className="text-xs text-muted-foreground">{change.note}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {review.removed.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium">Removed sentences ({review.removed.length})</summary>
              <ul className="mt-2 space-y-3">
                {review.removed.map((item) => (
                  <li key={item.text} className="border-l-2 border-destructive/50 pl-3">
                    <p>{item.text}</p>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {view === "compare" ? (
          <aside className="overflow-hidden rounded-lg border bg-card/70 backdrop-blur xl:sticky xl:top-4 xl:h-[calc(100dvh-6rem)] xl:self-start">
            <OriginalPane
              sources={sources}
              selected={selected}
              review={selected ? review.sentences[selected.id] : undefined}
              editor={editor}
            />
          </aside>
        ) : (
          <aside className="thin-scroll space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto">
            <EvidencePanel
              sentence={selected}
              sources={sources}
              review={selected ? review.sentences[selected.id] : undefined}
              flags={selected ? review.flags.filter((f) => f.sentenceId === selected.id) : undefined}
            />
            {editor}
          </aside>
        )}
      </div>
    </motion.div>
  );
}
