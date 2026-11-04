"use client";

import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, ClipboardPaste, PenLine, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { OutletAvatar } from "@/components/outlet-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/format";
import { pendingStage, type PendingStage } from "@/lib/story-stage";
import type { StoryListItem } from "@/lib/types";

const STAGES: { id: PendingStage; title: string; hint: string; action: string; icon: React.ElementType; color: string }[] = [
  { id: "review", title: "In review", hint: "Written versions waiting for you to read and approve.", action: "Review", icon: PenLine, color: "text-amber-500" },
  { id: "write", title: "Ready to write", hint: "The article is captured. Generate your versions.", action: "Write versions", icon: Sparkles, color: "text-primary" },
  { id: "article", title: "Needs article", hint: "The site blocked automatic reading. Grab or paste the text.", action: "Add article", icon: ClipboardPaste, color: "text-down" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
};

function detail(story: StoryListItem, stage: PendingStage): string {
  if (stage === "review") {
    const waiting = story.version_count - story.approved_count;
    return `${waiting} ${waiting === 1 ? "version" : "versions"} to review${story.approved_count > 0 ? `, ${story.approved_count} approved` : ""}`;
  }
  return stage === "write" ? `${story.source_count} ${story.source_count === 1 ? "source" : "sources"} captured` : "No article text yet";
}

export function PendingList({ stories }: { stories: StoryListItem[] }) {
  const [query, setQuery] = useState("");

  const pending = useMemo(() => stories.filter((story) => pendingStage(story) !== null), [stories]);
  const groups = useMemo(() => {
    const terms = query.trim().toLowerCase();
    const matching = pending.filter((story) => !terms || `${story.title} ${story.outlet_name ?? ""}`.toLowerCase().includes(terms));
    return STAGES.map((stage) => ({ stage, stories: matching.filter((story) => pendingStage(story) === stage.id) })).filter((group) => group.stories.length > 0);
  }, [pending, query]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-gradient text-3xl font-bold tracking-tight">Pending</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length === 1 ? "1 story needs" : `${pending.length} stories need`} something from you before they can be published.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pending stories" aria-label="Search pending stories" className="h-10 bg-card/60 pl-9" />
        </div>
      )}

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
          <CheckCircle2 className="mx-auto size-8 text-up" />
          <p className="mt-3 font-medium">Nothing is pending</p>
          <p className="mt-1 text-sm text-muted-foreground">Pick a headline on the News desk to start your next story.</p>
          <Button variant="outline" className="mt-4" nativeButton={false} render={<Link href="/" />}>
            Go to the News desk
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No pending stories match.</p>
      ) : (
        groups.map(({ stage, stories: inStage }) => (
          <section key={stage.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <stage.icon className={`size-4 ${stage.color}`} />
              <h2 className="text-sm font-semibold">{stage.title}</h2>
              <span className="tabular rounded-sm bg-muted px-1.5 text-xs text-muted-foreground">{inStage.length}</span>
              <p className="hidden text-xs text-muted-foreground sm:block">{stage.hint}</p>
            </div>
            <motion.ul variants={container} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {inStage.map((story) => (
                <motion.li key={story.id} variants={item} whileHover={{ y: -3 }}>
                  <Link href={`/stories/${story.id}`} className="group flex h-full flex-col gap-3 rounded-lg border bg-card/70 p-4 backdrop-blur transition-colors hover:border-primary/50">
                    <div className="flex items-center gap-2 text-xs">
                      <OutletAvatar name={story.outlet_name ?? story.title} size={24} />
                      <span className="min-w-0 truncate font-medium">{story.outlet_name ?? "No source yet"}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground" suppressHydrationWarning>
                        {timeAgo(story.created_at)}
                      </span>
                    </div>
                    <p className="flex-1 font-semibold leading-snug tracking-tight text-pretty">{story.title}</p>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{detail(story, stage.id)}</span>
                      <span className="flex shrink-0 items-center gap-1 font-medium text-primary">
                        {stage.action} <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </section>
        ))
      )}
    </div>
  );
}
