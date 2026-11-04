"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { BookOpenCheck, Eye, FileStack, KeyRound, Loader2, PenLine, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FactsPanel } from "@/components/facts-panel";
import { ShareDialog } from "@/components/share-dialog";
import { SourcesPanel } from "@/components/sources-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VersionGenerator } from "@/components/version-generator";
import { VersionPanel, type AiTask } from "@/components/version-panel";
import { detectLanguage, MAX_VERSIONS } from "@/lib/options";
import type { Source, Story, Version } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;
// How often an open story checks for changes made elsewhere: by its owner, or in another tab.
const LIVE_POLL_MS = 4000;
type Tab = "versions" | "sources" | "facts";

export function StoryWorkspace({
  story: initialStory,
  sources: initialSources,
  versions: initialVersions,
  initialVersionId,
}: {
  story: Story;
  sources: Source[];
  versions: Version[];
  initialVersionId?: string;
}) {
  const router = useRouter();
  const [story, setStory] = useState(initialStory);
  const [sources, setSources] = useState(initialSources);
  const [versions, setVersions] = useState(initialVersions);
  const [activeId, setActiveId] = useState<string | null>(
    initialVersions.find((v) => v.id === initialVersionId)?.id ?? initialVersions.at(-1)?.id ?? null,
  );
  // Owners and editors can change the story. Viewers, and admins reviewing it, only read.
  const readOnly = story.access === "view";
  const editRequested = story.my_pending_requests.some((request) => request.kind === "edit");
  const [requesting, setRequesting] = useState(false);

  const requestEdit = async () => {
    setRequesting(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "edit", storyId: story.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStory((current) => ({ ...current, my_pending_requests: [...current.my_pending_requests, { kind: "edit", version_id: null }] }));
      toast.success(`Request sent. ${story.owner_name} can approve it from their Requests page.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The request could not be sent.");
    } finally {
      setRequesting(false);
    }
  };
  const [tab, setTab] = useState<Tab>(initialSources.length === 0 && !readOnly ? "sources" : "versions");
  const [task, setTask] = useState<AiTask | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const revision = useRef(initialStory.updated_at);
  const busy = useRef(false);
  useEffect(() => {
    busy.current = task !== null;
  }, [task]);

  // Keeps the page in step with the database, so a viewer sees the owner's edits within seconds.
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || busy.current || document.visibilityState !== "visible") return;
      const response = await fetch(`/api/stories/${initialStory.id}/revision`, {
        cache: "no-store",
      }).catch(() => null);
      if (!response) return;
      if (response.status === 404) {
        stopped = true;
        toast.info(readOnly ? "This story is no longer shared with you." : "This story was deleted.");
        router.push(readOnly ? "/shared" : "/stories");
        router.refresh();
        return;
      }
      const { updatedAt } = await response.json();
      if (!updatedAt || updatedAt === revision.current) return;
      const bundle = await fetch(`/api/stories/${initialStory.id}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!bundle || stopped || busy.current) return;
      revision.current = bundle.story.updated_at;
      setStory(bundle.story);
      setSources(bundle.sources);
      setVersions(bundle.versions);
      setActiveId((current) => (bundle.versions.some((v: Version) => v.id === current) ? current : (bundle.versions.at(-1)?.id ?? null)));
      if (readOnly) {
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2500);
      }
    };
    const timer = window.setInterval(check, LIVE_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [initialStory.id, readOnly, router]);

  // Adding a version can race with a live refresh that already brought it in.
  const addVersion = (version: Version) => {
    setVersions((current) => (current.some((v) => v.id === version.id) ? current : [...current, version]));
    setActiveId(version.id);
  };

  const active = versions.find((v) => v.id === activeId) ?? null;
  const tabs = [
    {
      id: "versions" as const,
      label: `Versions (${versions.length}/${MAX_VERSIONS})`,
      icon: PenLine,
    },
    {
      id: "sources" as const,
      label: `Sources (${sources.length})`,
      icon: FileStack,
    },
    {
      id: "facts" as const,
      label: `Facts (${story.facts?.length ?? 0})`,
      icon: BookOpenCheck,
    },
  ];

  const replaceVersion = (version: Version) => {
    setVersions((current) => current.map((v) => (v.id === version.id ? version : v)));
    router.refresh();
  };

  const removeVersion = (id: string) => {
    const remaining = versions.filter((v) => v.id !== id);
    setVersions(remaining);
    setActiveId(remaining.at(-1)?.id ?? null);
    router.refresh();
  };

  const deleteStory = async () => {
    const response = await fetch(`/api/stories/${story.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("The story could not be deleted.");
      return;
    }
    router.push("/stories");
    router.refresh();
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-gradient text-2xl font-bold tracking-tight text-balance sm:text-3xl">{story.title}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5" title="Changes appear here within a few seconds">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-up" />
              </span>
              Live
            </span>
            {story.access === "edit" && (
              <span className="flex items-center gap-1.5">
                <PenLine className="size-3.5" /> Shared by {story.owner_name}. You can edit.
              </span>
            )}
            {readOnly && (
              <span className="flex items-center gap-1.5">
                <Eye className="size-3.5" /> {story.shared_with_me ? `Shared by ${story.owner_name}. View only.` : `By ${story.owner_name}. You are viewing as an admin.`}
              </span>
            )}
            <AnimatePresence>
              {justUpdated && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-medium text-primary"
                >
                  Updated just now
                </motion.span>
              )}
            </AnimatePresence>
          </p>
        </div>
        {readOnly && story.shared_with_me && (
          <Button variant="outline" size="sm" onClick={requestEdit} disabled={editRequested || requesting} title={editRequested ? "Waiting for the owner to answer" : undefined}>
            {requesting ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {editRequested ? "Edit access requested" : "Request edit access"}
          </Button>
        )}
        {story.access === "own" && (
          <div className="flex items-center gap-1">
            <ShareDialog storyId={story.id} />
            <Dialog>
              <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Delete story" />}>
                <Trash2 />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this story?</DialogTitle>
                  <DialogDescription>
                    This permanently deletes its captured sources, all its versions, and any links you shared.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={deleteStory}>
                    Delete story
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div
        className="thin-scroll flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1"
        role="tablist"
        aria-label="Story sections"
      >
        <LayoutGroup id="story-tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === item.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === item.id && (
                <motion.span
                  layoutId="story-tab-pill"
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={SPRING}
                />
              )}
              <item.icon className="relative size-3.5" />
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </LayoutGroup>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
          className="space-y-5"
        >
          {tab === "versions" && (
            <>
              {!readOnly && (
                <VersionGenerator
                  storyId={story.id}
                  defaultOpen={versions.length === 0}
                  sourceLanguage={detectLanguage(sources.flatMap((s) => s.paragraphs))}
                  disabledReason={
                    sources.length === 0
                      ? "Add a source in the Sources tab first."
                      : task
                        ? "Wait for the current Gemini task to finish."
                        : null
                  }
                  remaining={MAX_VERSIONS - versions.length}
                  onCreated={(version, facts, conflicts) => {
                    addVersion(version);
                    setStory((current) => ({ ...current, facts, conflicts }));
                    router.refresh();
                  }}
                />
              )}

              {readOnly && versions.length === 0 && (
                <p className="rounded-lg border border-dashed bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
                  {story.owner_name} has not written a version yet. It will appear here as soon as they do.
                </p>
              )}

              <AnimatePresence initial={false}>
                {task && (
                  <motion.p
                    role="status"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 overflow-hidden text-sm text-muted-foreground"
                  >
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    {task.message}. This can take a minute or two.
                  </motion.p>
                )}
              </AnimatePresence>

              {versions.length > 0 && (
                <div role="tablist" aria-label="Versions" className="flex flex-wrap gap-1.5">
                  <LayoutGroup id="version-tabs">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        role="tab"
                        aria-selected={version.id === activeId}
                        onClick={() => setActiveId(version.id)}
                        className={cn(
                          "relative rounded-md border bg-card/60 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:border-primary/40",
                          version.id === activeId && "border-primary text-primary",
                        )}
                      >
                        {version.id === activeId && (
                          <motion.span layoutId="version-pill" className="absolute inset-0 rounded-md bg-primary/12" transition={SPRING} />
                        )}
                        <span className="relative">{version.label}</span>
                        <span
                          className={cn(
                            "relative ml-2 inline-block size-1.5 rounded-full align-middle",
                            version.status === "reviewed" ? "bg-up" : "bg-amber-500",
                          )}
                        />
                      </button>
                    ))}
                  </LayoutGroup>
                </div>
              )}

              {active && (
                <VersionPanel
                  key={active.id}
                  version={active}
                  sources={sources}
                  storyIsFull={versions.length >= MAX_VERSIONS}
                  readOnly={readOnly}
                  storyAccess={story.access}
                  publishRequested={story.my_pending_requests.some((request) => request.kind === "publish" && request.version_id === active.id)}
                  onPublishRequested={() =>
                    setStory((current) => ({
                      ...current,
                      my_pending_requests: [...current.my_pending_requests, { kind: "publish", version_id: active.id }],
                    }))
                  }
                  task={task}
                  onTaskChange={setTask}
                  onChange={replaceVersion}
                  onDelete={removeVersion}
                  onTranslated={(version) => {
                    addVersion(version);
                    router.refresh();
                  }}
                />
              )}
            </>
          )}

          {tab === "sources" && (
            <SourcesPanel
              storyId={story.id}
              sources={sources}
              pending={readOnly ? [] : story.pending_sources}
              readOnly={readOnly}
              onAdded={(source, pending) => {
                setSources((current) => [...current, source]);
                setStory((current) => ({
                  ...current,
                  pending_sources: pending,
                  facts: null,
                  conflicts: [],
                }));
                // Once the last pasted article is in, the next step is writing versions.
                if (pending.length === 0) setTab("versions");
                router.refresh();
              }}
            />
          )}

          {tab === "facts" && <FactsPanel story={story} sources={sources} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
