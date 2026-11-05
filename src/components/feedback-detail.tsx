"use client";

import { motion } from "motion/react";
import { ArrowLeft, ChevronUp, Loader2, MapPin, Pencil, Send, ShieldCheck, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { initialsOf, useCurrentUser } from "@/components/current-user";
import { KindBadge, StatusBadge } from "@/components/feedback-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  statusMeta,
  taskKey,
  type FeedbackComment,
  type FeedbackItem,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/feedback-meta";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

async function call<T>(url: string, method: string, body?: object): Promise<T> {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

/** The developer's controls: whether it is doable, how urgent it is, and a note the reporter sees. */
function TriagePanel({ item, onSaved }: { item: FeedbackItem; onSaved: (item: FeedbackItem, comments: FeedbackComment[]) => void }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [priority, setPriority] = useState<FeedbackPriority>(item.priority);
  const [note, setNote] = useState(item.developer_note ?? "");
  const [saving, setSaving] = useState(false);
  const changed = status !== item.status || priority !== item.priority || note !== (item.developer_note ?? "");
  const needsNote = status === "not_doable" && !note.trim();

  const save = async () => {
    setSaving(true);
    try {
      const data = await call<{ item: FeedbackItem; comments: FeedbackComment[] }>(`/api/feedback/${item.number}`, "PATCH", {
        status,
        priority,
        developerNote: note,
      });
      onSaved(data.item, data.comments);
      toast.success(`${taskKey(item.number)} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "It could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Wrench className="size-4 text-primary" /> Developer triage
      </h2>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Status">
          {FEEDBACK_STATUSES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={status === option.id}
              onClick={() => setStatus(option.id)}
              title={option.hint}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors",
                status === option.id ? "border-primary bg-background ring-1 ring-primary/30" : "bg-background/50 hover:border-primary/40",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-full", option.dot)} /> {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Priority</Label>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="Priority">
          {FEEDBACK_PRIORITIES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={priority === option.id}
              onClick={() => setPriority(option.id)}
              className={cn("rounded-md py-1 text-xs font-medium", priority === option.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-note">Note to the reporter</Label>
        <Textarea
          id="dev-note"
          rows={4}
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={status === "not_doable" ? "Explain why this cannot be done." : "e.g. Planned for next week, or what was changed."}
        />
        {needsNote && <p className="text-xs text-amber-600 dark:text-amber-400">Add a short reason so the reporter knows why.</p>}
      </div>
      <Button className="w-full" onClick={save} disabled={!changed || saving || needsNote}>
        {saving && <Loader2 className="animate-spin" />} Save
      </Button>
    </section>
  );
}

export function FeedbackDetail({ item: initialItem, comments: initialComments }: { item: FeedbackItem; comments: FeedbackComment[] }) {
  const user = useCurrentUser();
  const router = useRouter();
  const [item, setItem] = useState(initialItem);
  const [comments, setComments] = useState(initialComments);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const isAdmin = user.role === "admin";
  const canEditText = isAdmin || (item.reporter_id === user.id && item.status === "new");
  const meta = statusMeta(item.status);

  const vote = async () => {
    try {
      setItem((await call<{ item: FeedbackItem }>(`/api/feedback/${item.number}/vote`, "POST")).item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work.");
    }
  };

  const sendReply = async () => {
    setSending(true);
    try {
      setComments((await call<{ comments: FeedbackComment[] }>(`/api/feedback/${item.number}/comments`, "POST", { body: reply })).comments);
      setReply("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The comment could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const saveText = async () => {
    try {
      const data = await call<{ item: FeedbackItem; comments: FeedbackComment[] }>(`/api/feedback/${item.number}`, "PATCH", { title, description });
      setItem(data.item);
      setEditing(false);
      toast.success("Saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "It could not be saved.");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${taskKey(item.number)}? This cannot be undone.`)) return;
    try {
      await call(`/api/feedback/${item.number}`, "DELETE");
      toast.success(`${taskKey(item.number)} deleted.`);
      router.push("/feedback");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "It could not be deleted.");
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href="/feedback" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All tasks
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold">{taskKey(item.number)}</span>
              <KindBadge kind={item.kind} />
              <StatusBadge status={item.status} />
              <Badge variant="secondary" className="capitalize">
                {item.priority} priority
              </Badge>
            </div>
            {editing ? (
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 text-lg font-semibold" aria-label="Title" />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{item.title}</h1>
            )}
            <p className="text-sm text-muted-foreground">
              Reported by <span className="font-medium text-foreground">{item.reporter_name}</span> · {formatDateTime(item.created_at)}
            </p>
          </motion.header>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={item.voted ? "default" : "outline"} size="sm" onClick={vote} aria-pressed={item.voted}>
              <ChevronUp /> Me too · {item.votes}
            </Button>
            {canEditText && !editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {canEditText && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                <Trash2 /> Delete
              </Button>
            )}
          </div>

          <section className="rounded-xl border bg-card/70 p-5 backdrop-blur">
            {item.page && (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" /> {item.page}
              </p>
            )}
            {editing ? (
              <div className="space-y-2">
                <Textarea rows={8} value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Description" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveText}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.description}</p>
            )}
          </section>

          {item.developer_note && (
            <section className={cn("rounded-xl border p-4", item.status === "not_doable" ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5")}>
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <ShieldCheck className="size-3.5 text-primary" /> Developer&apos;s note · {meta.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{item.developer_note}</p>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Activity</h2>
            <ol className="space-y-3">
              {comments.map((comment) =>
                comment.status_change ? (
                  <li key={comment.id} className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                    <span className={cn("size-2 rounded-full", statusMeta(comment.status_change as FeedbackStatus).dot)} />
                    <span className="font-medium text-foreground">{comment.author_name}</span> {comment.body.toLowerCase()} ·{" "}
                    <span suppressHydrationWarning>{timeAgo(comment.created_at)}</span>
                  </li>
                ) : (
                  <li key={comment.id} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">{initialsOf(comment.author_name)}</span>
                    <div className="min-w-0 flex-1 rounded-lg border bg-card/70 p-3">
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold">{comment.author_name}</span>
                        {comment.author_is_admin && <Badge variant="secondary">Developer</Badge>}
                        <span className="text-muted-foreground" suppressHydrationWarning>
                          {timeAgo(comment.created_at)}
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </li>
                ),
              )}
              {comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet.</li>}
            </ol>
            <div className="space-y-2 rounded-lg border bg-card/60 p-3">
              <Textarea rows={3} maxLength={3000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add details, a screenshot description, or a question" aria-label="Comment" />
              <div className="flex justify-end">
                <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
                  {sending ? <Loader2 className="animate-spin" /> : <Send />} Comment
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {isAdmin ? (
            <TriagePanel
              key={`${item.status}-${item.priority}-${item.developer_note}`}
              item={item}
              onSaved={(next, nextComments) => {
                setItem(next);
                setComments(nextComments);
                router.refresh();
              }}
            />
          ) : (
            <section className="space-y-2 rounded-xl border bg-card/70 p-4 text-sm">
              <h2 className="font-semibold">Where this stands</h2>
              <StatusBadge status={item.status} />
              <p className="text-muted-foreground">{meta.hint}.</p>
              <p className="text-xs text-muted-foreground">A developer updates the status here. Comments and status changes appear in the activity below.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
