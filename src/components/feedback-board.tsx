"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Bug, ChevronUp, Columns3, Lightbulb, List, Loader2, MessageSquare, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  statusMeta,
  taskKey,
  type FeedbackItem,
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/feedback-meta";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;

// "Not doable" and "Duplicate" share one closed column on the board.
const COLUMNS: { id: string; label: string; statuses: FeedbackStatus[] }[] = [
  { id: "new", label: "New", statuses: ["new"] },
  { id: "accepted", label: "Accepted", statuses: ["accepted"] },
  { id: "in_progress", label: "In progress", statuses: ["in_progress"] },
  { id: "done", label: "Done", statuses: ["done"] },
  { id: "closed", label: "Not doable", statuses: ["not_doable", "duplicate"] },
];

const PRIORITY_STYLE: Record<FeedbackPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-sky-600 dark:text-sky-400",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-destructive",
};

export function KindBadge({ kind }: { kind: FeedbackKind }) {
  return kind === "bug" ? (
    <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
      <Bug className="size-3" /> Bug
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
      <Lightbulb className="size-3" /> Feature
    </Badge>
  );
}

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = statusMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium" title={meta.hint}>
      <span className={cn("size-2 rounded-full", meta.dot)} /> {meta.label}
    </span>
  );
}

function NewFeedbackDialog({ kind, onClose }: { kind: FeedbackKind | null; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [saving, setSaving] = useState(false);
  const bug = kind === "bug";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind) return;
    setSaving(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title, description, page, priority }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`Filed as ${taskKey(data.number)}. You can follow it here.`);
      router.push(`/feedback/${data.number}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "It could not be saved.");
      setSaving(false);
    }
  };

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bug ? <Bug className="size-5 text-destructive" /> : <Lightbulb className="size-5 text-primary" />}
              {bug ? "Report a bug" : "Request a feature"}
            </DialogTitle>
            <DialogDescription>
              {bug ? "Tell the developer what went wrong, so they can reproduce and fix it." : "Describe what you would like NewsGen to do, and why it would help."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fb-title">Title</Label>
            <Input
              id="fb-title"
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={bug ? "e.g. PDF download fails on Filipino versions" : "e.g. Export versions to Word"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-description">{bug ? "What happened?" : "What should it do?"}</Label>
            <Textarea
              id="fb-description"
              required
              rows={6}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                bug ? "1. What you clicked\n2. What you expected\n3. What happened instead, including any error message" : "Who it is for, what it should do, and an example."
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-page">Where in the app? (optional)</Label>
            <Input id="fb-page" maxLength={300} value={page} onChange={(event) => setPage(event.target.value)} placeholder="e.g. Story page, Versions tab" />
          </div>
          <div className="space-y-1.5">
            <Label>{bug ? "How much does it get in the way?" : "How important is it to you?"}</Label>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup">
              {FEEDBACK_PRIORITIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={priority === option.id}
                  onClick={() => setPriority(option.id)}
                  className={cn("rounded-md py-1.5 text-xs font-medium transition-colors", priority === option.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || title.trim().length < 3 || !description.trim()}>
              {saving && <Loader2 className="animate-spin" />} Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ item }: { item: FeedbackItem }) {
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileHover={{ y: -2 }}>
      <Link href={`/feedback/${item.number}`} className="block space-y-2 rounded-lg border bg-card/80 p-3 backdrop-blur transition-colors hover:border-primary/50">
        <div className="flex items-center gap-2 text-xs">
          <span className="tabular font-mono font-semibold text-muted-foreground">{taskKey(item.number)}</span>
          <KindBadge kind={item.kind} />
          <span className={cn("ml-auto text-[11px] font-medium capitalize", PRIORITY_STYLE[item.priority])}>{item.priority}</span>
        </div>
        <p className="text-sm leading-snug font-medium text-pretty">{item.title}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className={cn("flex items-center gap-0.5", item.voted && "text-primary")}>
            <ChevronUp className="size-3.5" /> {item.votes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" /> {item.comment_count}
          </span>
          <span className="ml-auto truncate" suppressHydrationWarning>
            {item.reporter_name} · {timeAgo(item.created_at)}
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

export function FeedbackBoard({ items }: { items: FeedbackItem[] }) {
  const user = useCurrentUser();
  const [creating, setCreating] = useState<FeedbackKind | null>(null);
  const [kind, setKind] = useState<"all" | FeedbackKind>("all");
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");

  const shown = useMemo(() => {
    const terms = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (mine && item.reporter_id !== user.id) return false;
      return !terms || `${taskKey(item.number)} ${item.title} ${item.description}`.toLowerCase().includes(terms);
    });
  }, [items, kind, mine, query, user.id]);

  const counts = { bug: items.filter((i) => i.kind === "bug").length, feature: items.filter((i) => i.kind === "feature").length };
  const open = items.filter((i) => ["new", "accepted", "in_progress"].includes(i.status)).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-gradient text-3xl font-bold tracking-tight">Bugs &amp; feature requests</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every report becomes a numbered task. A developer reviews each one, decides whether it is doable, and moves it across the board. {open} open
            right now.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreating("bug")}>
            <Bug /> Report a bug
          </Button>
          <Button className="shadow-lg shadow-primary/25" onClick={() => setCreating("feature")}>
            <Plus /> Request a feature
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, e.g. NG-4" aria-label="Search tasks" className="h-9 bg-card/60 pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="Type">
          <LayoutGroup id="fb-kind">
            {(
              [
                { id: "all", label: `All ${items.length}` },
                { id: "bug", label: `Bugs ${counts.bug}` },
                { id: "feature", label: `Features ${counts.feature}` },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={kind === option.id}
                onClick={() => setKind(option.id)}
                className={cn("relative rounded-md px-3 py-1 text-xs font-medium", kind === option.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {kind === option.id && <motion.span layoutId="fb-kind-pill" className="absolute inset-0 rounded-md bg-background shadow-sm" transition={SPRING} />}
                <span className="relative">{option.label}</span>
              </button>
            ))}
          </LayoutGroup>
        </div>
        <Button variant={mine ? "default" : "outline"} size="sm" aria-pressed={mine} onClick={() => setMine(!mine)}>
          Mine
        </Button>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="View">
          {(
            [
              { id: "board", label: "Board", icon: Columns3 },
              { id: "list", label: "List", icon: List },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={view === option.id}
              onClick={() => setView(option.id)}
              className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium", view === option.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <option.icon className="size-3.5" /> {option.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
          <Lightbulb className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No reports yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Found something broken, or have an idea? File the first one.</p>
        </div>
      ) : view === "board" ? (
        <div className="thin-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-5">
          {COLUMNS.map((column) => {
            const inColumn = shown.filter((item) => column.statuses.includes(item.status));
            return (
              <section key={column.id} className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 xl:w-auto">
                <header className="flex items-center gap-2 border-b px-3 py-2.5">
                  <span className={cn("size-2 rounded-full", statusMeta(column.statuses[0]).dot)} />
                  <h2 className="text-sm font-semibold">{column.label}</h2>
                  <span className="tabular ml-auto rounded-md bg-background/70 px-1.5 text-xs text-muted-foreground">{inColumn.length}</span>
                </header>
                <ul className="thin-scroll max-h-[65dvh] min-h-24 space-y-2 overflow-y-auto p-2">
                  <AnimatePresence initial={false}>
                    {inColumn.map((item) => (
                      <TaskCard key={item.id} item={item} />
                    ))}
                  </AnimatePresence>
                  {inColumn.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">Nothing here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card/70 backdrop-blur">
          {shown.map((item) => (
            <li key={item.id}>
              <Link href={`/feedback/${item.number}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/40">
                <span className="tabular w-14 font-mono text-xs font-semibold text-muted-foreground">{taskKey(item.number)}</span>
                <KindBadge kind={item.kind} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                <StatusBadge status={item.status} />
                <span className={cn("w-14 text-xs font-medium capitalize", PRIORITY_STYLE[item.priority])}>{item.priority}</span>
                <span className="flex w-10 items-center gap-0.5 text-xs text-muted-foreground">
                  <ChevronUp className="size-3.5" /> {item.votes}
                </span>
                <span className="w-16 text-right text-xs text-muted-foreground" suppressHydrationWarning>
                  {timeAgo(item.updated_at)}
                </span>
              </Link>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No tasks match.</li>}
        </ul>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {FEEDBACK_STATUSES.map((status) => (
          <span key={status.id} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", status.dot)} /> {status.label}: {status.hint.toLowerCase()}
          </span>
        ))}
      </p>

      <NewFeedbackDialog key={creating ?? "closed"} kind={creating} onClose={() => setCreating(null)} />
    </div>
  );
}
