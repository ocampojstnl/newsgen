"use client";

import { motion } from "motion/react";
import { CheckCircle2, Download, ExternalLink, Link2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OutletAvatar } from "@/components/outlet-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { readingMinutes } from "@/lib/options";
import type { ApprovedVersion } from "@/lib/types";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

export function ApprovedList({ versions }: { versions: ApprovedVersion[] }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const terms = query.trim().toLowerCase();
    if (!terms) return versions;
    return versions.filter((v) => `${v.headline} ${v.story_title} ${v.outlet_name ?? ""} ${v.byline ?? ""}`.toLowerCase().includes(terms));
  }, [versions, query]);

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    toast.success("Link copied.");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-gradient text-3xl font-bold tracking-tight">Approved</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {versions.length === 1 ? "1 version" : `${versions.length} versions`} you have read and approved, ready to download or share.
        </p>
      </div>

      {versions.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search approved versions" aria-label="Search approved versions" className="h-10 bg-card/60 pl-9" />
        </div>
      )}

      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
          <CheckCircle2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing approved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Versions appear here after you read and approve them.</p>
          <Button variant="outline" className="mt-4" nativeButton={false} render={<Link href="/pending" />}>
            See what is pending
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No approved versions match.</p>
      ) : (
        <motion.ul variants={container} initial="hidden" animate="show" className="grid gap-3 xl:grid-cols-2">
          {shown.map((version) => (
            <motion.li key={version.id} variants={item} className="flex flex-col gap-3 rounded-lg border bg-card/70 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-xs">
                <OutletAvatar name={version.outlet_name ?? version.story_title} size={24} />
                <span className="min-w-0 truncate font-medium">{version.outlet_name ?? "No source"}</span>
                {!version.is_owner && (
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Shared by {version.owner_name}
                  </Badge>
                )}
                <Badge variant="secondary" className={version.is_owner ? "ml-auto shrink-0" : "shrink-0"}>
                  {version.language}
                </Badge>
              </div>
              <Link href={`/stories/${version.story_id}?version=${version.id}`} className="font-semibold leading-snug tracking-tight text-pretty transition-colors hover:text-primary">
                {version.headline}
              </Link>
              <p className="flex-1 text-xs text-muted-foreground">
                {version.label} · {version.word_count.toLocaleString("en-PH")} words · {readingMinutes(version.word_count)}
                <br />
                {version.byline ? `By ${version.byline} · ` : ""}Approved {formatDateTime(version.reviewed_at)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/versions/${version.id}/pdf`} />}>
                  <Download /> PDF
                </Button>
                {version.share_token ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => copyLink(version.share_token!)}>
                      <Link2 /> Copy link
                    </Button>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<a href={`/s/${version.share_token}`} target="_blank" rel="noreferrer" />}>
                      Open public page <ExternalLink />
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/stories/${version.story_id}?version=${version.id}`} />}>
                    Open to create a link
                  </Button>
                )}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
