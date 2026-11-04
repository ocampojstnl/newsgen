"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, MousePointerClick, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OutletAvatar } from "@/components/outlet-avatar";
import { captureLabel, readableUrl } from "@/lib/evidence";
import { formatDateTime } from "@/lib/format";
import { findOutletNames } from "@/lib/outlet-names";
import type { Sentence, SentenceReview, Source } from "@/lib/types";

/** What the pane needs from a source, so public pages can pass their reduced copy. */
export type OriginalSource = Pick<Source, "label" | "outlet_name" | "url" | "title" | "author" | "capture_method" | "fetched_at" | "paragraphs">;
import { cn } from "@/lib/utils";

const VERDICTS = {
  supported: { label: "Supported by the original", Icon: CheckCircle2, className: "text-up" },
  partial: { label: "Partly supported, check this", Icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  unsupported: { label: "Not supported, fix or remove", Icon: XCircle, className: "text-destructive" },
};

/** Marks the quoted passage inside a paragraph, when it appears there word for word. */
function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const lower = text.toLowerCase();
  const ranges = quotes
    .map((quote) => {
      const start = lower.indexOf(quote.toLowerCase().trim());
      return start < 0 ? null : ([start, start + quote.trim().length] as const);
    })
    .filter((range): range is readonly [number, number] => range !== null)
    .sort((a, b) => a[0] - b[0]);
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="rounded-[3px] bg-primary/25 px-0.5 text-foreground [box-decoration-break:clone]">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** The original article beside the generated version. The selected sentence's source passages are highlighted. */
export function OriginalPane({
  sources,
  selected,
  review,
  editor,
  showLogos = true,
}: {
  sources: OriginalSource[];
  selected: Sentence | null;
  review?: SentenceReview;
  editor?: React.ReactNode;
  /** False on public pages, where outlet logos are not shown. */
  showLogos?: boolean;
}) {
  const [activeLabel, setActiveLabel] = useState(sources[0]?.label ?? "");
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const firstCited = useRef<HTMLLIElement | null>(null);

  // A newly selected sentence switches to the source it came from.
  const citedLabel = selected?.evidence[0]?.source;
  if (selected && selected.id !== lastSelected) {
    setLastSelected(selected.id);
    if (citedLabel && citedLabel !== activeLabel) setActiveLabel(citedLabel);
  }

  const source = sources.find((s) => s.label === activeLabel) ?? sources[0];
  const evidence = selected?.evidence.filter((e) => e.source === source?.label) ?? [];
  const citedParagraphs = new Set(evidence.map((e) => e.paragraph));
  const firstParagraph = Math.min(...evidence.map((e) => e.paragraph));

  useEffect(() => {
    firstCited.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected?.id, activeLabel]);

  if (!source) return <p className="p-6 text-sm text-muted-foreground">No source article is attached to this story.</p>;
  const verdict = review ? VERDICTS[review.verdict] : null;
  const otherSources = selected ? [...new Set(selected.evidence.map((e) => e.source))].filter((label) => label !== source.label) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <FileText className="size-3.5" /> Original article
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open the page <ExternalLink className="size-3" />
          </a>
        </div>
        {sources.length > 1 && (
          <div className="thin-scroll flex gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1" role="tablist" aria-label="Source articles">
            <LayoutGroup id="original-tabs">
              {sources.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="tab"
                  aria-selected={item.label === source.label}
                  onClick={() => setActiveLabel(item.label)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                    item.label === source.label ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label === source.label && (
                    <motion.span
                      layoutId="original-tab"
                      className="absolute inset-0 rounded-md bg-background shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  {showLogos && (
                    <span className="relative">
                      <OutletAvatar name={item.outlet_name} size={16} />
                    </span>
                  )}
                  <span className="relative">{item.outlet_name}</span>
                </button>
              ))}
            </LayoutGroup>
          </div>
        )}
        <div className="flex gap-3">
          {showLogos && <OutletAvatar name={source.outlet_name} size={36} />}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-pretty">{source.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={readableUrl(source.url)}>
              {source.outlet_name}
              {source.author ? ` · ${source.author}` : ""} · {captureLabel(source.capture_method)}, {formatDateTime(source.fetched_at)}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="space-y-2 border-b bg-primary/5 p-4 text-sm"
          >
            {verdict && review && (
              <p className={cn("flex items-center gap-1.5 font-medium", verdict.className)}>
                <verdict.Icon className="size-4 shrink-0" /> {verdict.label}
              </p>
            )}
            {review?.note && review.verdict !== "supported" && <p className="text-muted-foreground">{review.note}</p>}
            {review?.unmatchedNumbers.length ? (
              <p className="text-amber-600 dark:text-amber-400">Figure not in the original: {review.unmatchedNumbers.join(", ")}</p>
            ) : null}
            {review?.unverifiedQuotes.map((quote) => (
              <p key={quote} className="text-destructive">
                Quotation not found word for word: &ldquo;{quote}&rdquo;
              </p>
            ))}
            {review?.copiedPhrase && (
              <p className="text-amber-600 dark:text-amber-400">Same wording as the original: &ldquo;{review.copiedPhrase}&rdquo;</p>
            )}
            {findOutletNames(selected.text).length > 0 && (
              <p className="text-amber-600 dark:text-amber-400">Names a news outlet: {findOutletNames(selected.text).join(", ")}</p>
            )}
            {!review && evidence.length > 0 && <p className="text-muted-foreground">The highlighted passage below is where this sentence came from.</p>}
            {selected.evidence.length === 0 && <p className="text-destructive">No passage of the original backs this sentence.</p>}
            {evidence.length === 0 && otherSources.length > 0 && (
              <p className="text-muted-foreground">
                This sentence comes from{" "}
                {otherSources.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveLabel(label)}
                    className="font-medium text-primary hover:underline"
                  >
                    {sources.find((s) => s.label === label)?.outlet_name ?? label}
                  </button>
                ))}
                .
              </p>
            )}
            {editor}
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 border-b p-4 text-xs text-muted-foreground"
          >
            <MousePointerClick className="size-4 shrink-0 text-primary" /> Click any sentence on the left to highlight where it came from
            here.
          </motion.p>
        )}
      </AnimatePresence>

      <ol className="thin-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
        {source.paragraphs.map((paragraph, index) => {
          const number = index + 1;
          const cited = citedParagraphs.has(number);
          return (
            <li
              key={number}
              ref={cited && number === firstParagraph ? firstCited : undefined}
              className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-1 rounded-md py-1.5 pr-2 text-sm leading-relaxed transition-colors duration-300",
                cited
                  ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : selected
                    ? "text-muted-foreground/70"
                    : "text-foreground/85",
              )}
            >
              <span className={cn("tabular pt-0.5 text-right text-[11px]", cited ? "font-semibold text-primary" : "text-muted-foreground")}>
                ¶{number}
              </span>
              <span className="pl-1">
                {cited ? (
                  <Highlighted text={paragraph} quotes={evidence.filter((e) => e.paragraph === number).map((e) => e.quote)} />
                ) : (
                  paragraph
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
