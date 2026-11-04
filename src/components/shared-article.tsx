"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { BadgeCheck, Check, Clock, Download, ExternalLink, FileSearch, FileText, Link2, Newspaper, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/app-shell";
import { ClearViewToggle } from "@/components/clear-view-toggle";
import { EvidencePanel } from "@/components/evidence-panel";
import { OriginalPane } from "@/components/original-pane";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { allSentences, citedSources, readableUrl, shortCredit, sourcesHeading } from "@/lib/evidence";
import { readingMinutes } from "@/lib/options";
import type { Sentence, SharedVersion } from "@/lib/types";
import { cn } from "@/lib/utils";

const WIDE_QUERY = "(min-width: 1024px)";

const longDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" });

function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function SharedArticle({ shared, token }: { shared: SharedVersion; token: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isWide = useIsWide();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });

  const { content } = shared;
  const selected = allSentences(content).find((s) => s.id === selectedId) ?? null;
  const cited = citedSources(content, shared.sources);

  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id));

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  /** Each sentence opens its evidence. Hover stays subtle so the page reads as an article, not a form. */
  const sentenceProps = (sentence: Sentence) => ({
    role: "button",
    tabIndex: 0,
    "aria-pressed": selectedId === sentence.id,
    onClick: () => toggle(sentence.id),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle(sentence.id);
      }
    },
    className: cn(
      "cursor-pointer rounded-[3px] [box-decoration-break:clone] transition-colors duration-150 outline-none hover:bg-primary/10 focus-visible:bg-primary/15",
      selectedId === sentence.id && "bg-primary/20 hover:bg-primary/20",
    ),
  });

  const evidence = selected && <EvidencePanel sentence={selected} sources={shared.sources} />;
  // Present only when an admin chose to publish the original article with this version.
  const originals = shared.public_mode === "article_with_original" ? shared.sources.filter((source) => source.paragraphs) : [];
  const withOriginal = originals.length > 0;
  const [originalOpen, setOriginalOpen] = useState(false);
  const originalPane = withOriginal && (
    <OriginalPane sources={originals.map((source) => ({ ...source, paragraphs: source.paragraphs ?? [] }))} selected={selected} showLogos={false} />
  );

  return (
    <div className="bg-glow relative min-h-dvh">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-96" aria-hidden />

      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <span className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Newspaper className="size-4" />
            </span>
            NewsGen
          </span>
          <Button variant="ghost" size="sm" onClick={copyLink} aria-label="Copy link to this article">
            {copied ? <Check className="text-up" /> : <Link2 />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/s/${token}/pdf`} aria-label="Download PDF" />}>
            <Download /> <span className="hidden sm:inline">PDF</span>
          </Button>
          <ClearViewToggle />
          <ThemeToggle />
        </div>
        <motion.div className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-primary" style={{ scaleX: progress }} aria-hidden />
      </header>

      <main className={`relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-20 sm:px-6 sm:pt-14 ${withOriginal ? "lg:max-w-7xl lg:grid-cols-2 lg:gap-10" : "lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14"}`}>
        <article className="mx-auto w-full max-w-[42rem] min-w-0">
          <motion.header {...rise(0)}>
            <h1 className="text-3xl leading-[1.15] font-bold tracking-tight text-balance sm:text-[2.75rem]">
              <span {...sentenceProps(content.headline)}>{content.headline.text}</span>
            </h1>
            {content.dek && (
              <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
                <span {...sentenceProps(content.dek)}>{content.dek.text}</span>
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3 text-sm text-muted-foreground">
              {shared.byline && (
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary uppercase">
                    {shared.byline.trim()[0]}
                  </span>
                  {shared.byline}
                </span>
              )}
              {shared.reviewed_at && <span>{longDate.format(new Date(shared.reviewed_at))}</span>}
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> {readingMinutes(shared.word_count)}
              </span>
            </div>
          </motion.header>

          <motion.div {...rise(0.08)} className="mt-8 space-y-6 text-[1.0625rem] leading-[1.85] text-foreground/90 sm:text-lg sm:leading-[1.85]">
            {content.paragraphs.map((paragraph) => (
              <p key={paragraph[0].id} className="text-pretty">
                {paragraph.map((sentence, index) => (
                  <span key={sentence.id}>
                    <span {...sentenceProps(sentence)}>{sentence.text}</span>
                    {index < paragraph.length - 1 ? " " : ""}
                  </span>
                ))}
              </p>
            ))}
          </motion.div>

          <motion.footer {...rise(0.14)} className="mt-12 rounded-lg border bg-card/70 p-5 backdrop-blur sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">{sourcesHeading(shared.language)}</h2>
            <p className="mt-1 text-sm text-muted-foreground italic">{shortCredit(content.credit)}</p>
            <ol className="mt-4 space-y-4">
              {cited.map((source, index) => (
                <li key={source.label} className="flex gap-3 text-sm">
                  <span className="tabular w-4 shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-pretty">
                      {source.outlet_name}: {source.title}
                    </span>
                    <a href={source.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-start gap-1 text-xs break-all text-primary underline-offset-2 hover:underline">
                      {readableUrl(source.url)} <ExternalLink className="mt-0.5 size-3 shrink-0" />
                    </a>
                  </span>
                </li>
              ))}
            </ol>
            {shared.reviewed_at && (
              <p className="mt-5 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
                <BadgeCheck className="size-4 text-up" /> Read and approved by the reporter before publishing.
              </p>
            )}
          </motion.footer>
        </article>

        {withOriginal ? (
          <aside className="hidden overflow-hidden rounded-lg border bg-card/70 lg:sticky lg:top-20 lg:block lg:h-[calc(100dvh-6rem)] lg:self-start">
            {isWide && originalPane}
          </aside>
        ) : (
        <aside className="thin-scroll hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div key="evidence" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.18 }} className="relative">
                {isWide && evidence}
                <Button variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground" onClick={() => setSelectedId(null)}>
                  <X /> Close evidence
                </Button>
              </motion.div>
            ) : (
              <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                <div className="flex gap-3 rounded-lg border bg-card/60 p-4 text-sm backdrop-blur">
                  <FileSearch className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Check any line.</span> Select a sentence to see the passage it came from.
                  </p>
                </div>
                <div className="px-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Based on</p>
                  <ul className="mt-2 space-y-1.5">
                    {cited.map((source) => (
                      <li key={source.label} className="truncate text-sm font-medium">
                        {source.outlet_name}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
        )}
      </main>

      {!isWide && (
        <div className="relative -mt-12 space-y-3 px-4 pb-10 text-center">
          {withOriginal && (
            <Button variant="outline" onClick={() => setOriginalOpen(true)}>
              <FileText /> Read the original news
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Tap any sentence to see where it came from.</p>
        </div>
      )}

      <Sheet
        open={!isWide && (selected !== null || originalOpen)}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedId(null);
          setOriginalOpen(false);
        }}
      >
        <SheetContent side="bottom" className={withOriginal ? "h-[80dvh] p-0 pt-10" : "thin-scroll max-h-[75dvh] overflow-y-auto p-4 pt-10"}>
          <SheetTitle className="sr-only">{withOriginal ? "Original news" : "Evidence"}</SheetTitle>
          {!isWide && (withOriginal ? originalPane : evidence)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
