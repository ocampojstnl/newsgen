"use client";

import { motion } from "motion/react";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { OutletAvatar } from "@/components/outlet-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { StoryListItem } from "@/lib/types";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

export function StoriesGrid({
  stories,
  title = "My stories",
  description = "Every story keeps its captured sources and up to 5 versions.",
  emptyTitle = "No stories yet",
  emptyText = "Select articles on the News desk to start one.",
}: {
  stories: StoryListItem[];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyText?: string;
}) {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-gradient text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button className="group shadow-lg shadow-primary/25" nativeButton={false} render={<Link href="/" />}>
          <Plus className="transition-transform group-hover:rotate-90" /> New story
        </Button>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <motion.ul variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stories.map((story) => (
            <motion.li key={story.id} variants={item} whileHover={{ y: -3 }}>
              <Link
                href={`/stories/${story.id}`}
                className="flex h-full flex-col gap-3 rounded-lg border bg-card/70 p-4 backdrop-blur transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-2.5">
                  <OutletAvatar name={story.outlet_name ?? story.title} size={30} />
                  <span className="truncate text-xs font-medium">{story.outlet_name ?? "No source yet"}</span>
                  {!story.is_owner ? (
                    <Badge className="ml-auto" variant="outline">
                      Shared by {story.owner_name}
                    </Badge>
                  ) : (
                    story.approved_count > 0 && (
                      <Badge className="ml-auto" variant="secondary">
                        {story.approved_count} approved
                      </Badge>
                    )
                  )}
                </div>
                <p className="flex-1 font-semibold tracking-tight text-pretty">{story.title}</p>
                <p className="text-xs text-muted-foreground">
                  {story.source_count} {story.source_count === 1 ? "source" : "sources"} · {story.version_count}/5 versions ·{" "}
                  {formatDateTime(story.created_at)}
                </p>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
