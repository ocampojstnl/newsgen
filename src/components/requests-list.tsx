"use client";

import { motion } from "motion/react";
import { Check, Globe, Inbox, KeyRound, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { initialsOf } from "@/components/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import type { AccessRequest } from "@/lib/requests";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: { label: "Waiting", className: "text-amber-600 dark:text-amber-400" },
  approved: { label: "Approved", className: "text-up" },
  declined: { label: "Declined", className: "text-destructive" },
};

function describe(request: AccessRequest): string {
  if (request.kind === "edit") return "wants edit access to";
  return request.public_mode === "article_with_original"
    ? "wants a public link, with the original news, for"
    : "wants a public link, article only, for";
}

function storyLink(request: AccessRequest) {
  return `/stories/${request.story_id}${request.version_id ? `?version=${request.version_id}` : ""}`;
}

export function RequestsList({ incoming, outgoing }: { incoming: AccessRequest[]; outgoing: AccessRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  const answer = async (request: AccessRequest, decision: "approve" | "decline") => {
    setBusyId(request.id);
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAnswered((current) => new Set(current).add(request.id));
      toast.success(
        decision === "decline"
          ? "Request declined."
          : request.kind === "edit"
            ? `${request.requester_name} can now edit this story.`
            : "Published. The public link is now live.",
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The request could not be answered.");
    } finally {
      setBusyId(null);
    }
  };

  const open = incoming.filter((request) => !answered.has(request.id));

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-gradient text-3xl font-bold tracking-tight">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit requests come to the story&apos;s owner. Requests for a public link come to admins.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Waiting for you</h2>
        {open.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/40 px-6 py-12 text-center">
            <Inbox className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nothing to answer right now.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {open.map((request, index) => (
              <motion.li
                key={request.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.04 }}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/70 p-4 backdrop-blur"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
                  {initialsOf(request.requester_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{request.requester_name}</span> {describe(request)}{" "}
                    <Link href={storyLink(request)} className="font-medium text-primary hover:underline">
                      {request.version_label ? `${request.version_label} of "${request.story_title}"` : `"${request.story_title}"`}
                    </Link>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="gap-1">
                      {request.kind === "edit" ? <KeyRound className="size-3" /> : <Globe className="size-3" />}
                      {request.kind === "edit" ? "Edit access" : "Public link"}
                    </Badge>
                    {request.kind === "publish" && <span>Owner: {request.owner_name}</span>}
                    <span suppressHydrationWarning>{timeAgo(request.created_at)}</span>
                  </p>
                  {request.kind === "publish" && request.public_mode === "article_with_original" && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      This would republish the outlet&apos;s full original article. Only approve if you have permission to.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => answer(request, "decline")} disabled={busyId !== null}>
                    <X /> Decline
                  </Button>
                  <Button size="sm" onClick={() => answer(request, "approve")} disabled={busyId !== null}>
                    {busyId === request.id ? <Loader2 className="animate-spin" /> : <Check />} Approve
                  </Button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Your requests</h2>
          <ul className="divide-y rounded-lg border bg-card/70 backdrop-blur">
            {outgoing.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                {request.kind === "edit" ? <KeyRound className="size-4 text-muted-foreground" /> : <Globe className="size-4 text-muted-foreground" />}
                <Link href={storyLink(request)} className="min-w-0 flex-1 truncate hover:text-primary">
                  {request.kind === "edit" ? "Edit access to " : "Public link for "}
                  {request.version_label ? `${request.version_label} of ` : ""}&ldquo;{request.story_title}&rdquo;
                </Link>
                <span className={cn("text-xs font-medium", STATUS[request.status].className)}>{STATUS[request.status].label}</span>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {timeAgo(request.decided_at ?? request.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
