"use client";

import { ExternalLink } from "lucide-react";
import { citedSources, readableUrl, shortCredit, sourcesHeading } from "@/lib/evidence";
import { readingMinutes } from "@/lib/options";
import { findOutletNames } from "@/lib/outlet-names";
import type { PublicSource, Sentence, SentenceReview, Source, VersionContent } from "@/lib/types";
import { cn } from "@/lib/utils";

function needsAttention(review?: SentenceReview): boolean {
  if (!review) return false;
  return (
    review.verdict !== "supported" ||
    review.unmatchedNumbers.length > 0 ||
    review.unverifiedQuotes.length > 0 ||
    review.copiedPhrase !== null
  );
}

export function ArticleView({
  content,
  byline,
  wordCount,
  selectedId,
  onSelect,
  reviews,
  flaggedIds,
  sources,
  language,
}: {
  content: VersionContent;
  byline: string | null;
  wordCount: number;
  sources: (PublicSource | Source)[];
  language: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reviews?: Record<string, SentenceReview>;
  flaggedIds?: Set<string>;
}) {
  const cited = citedSources(content, sources);

  const sentenceClass = (sentence: Sentence) =>
    cn(
      "cursor-pointer rounded-sm text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
      selectedId === sentence.id && "bg-accent ring-1 ring-primary/40",
      (needsAttention(reviews?.[sentence.id]) || flaggedIds?.has(sentence.id) || (reviews && findOutletNames(sentence.text).length > 0)) &&
        "underline decoration-amber-500 decoration-2 underline-offset-4",
    );

  const clickable = (sentence: Sentence) => ({
    role: "button",
    tabIndex: 0,
    className: sentenceClass(sentence),
    onClick: () => onSelect(sentence.id),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(sentence.id);
      }
    },
  });

  return (
    <article>
      <h2 className="text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">
        <span {...clickable(content.headline)}>{content.headline.text}</span>
      </h2>
      {content.dek && (
        <p className="mt-3 text-base text-muted-foreground">
          <span {...clickable(content.dek)}>{content.dek.text}</span>
        </p>
      )}
      <p className="mt-4 border-y py-2 text-xs text-muted-foreground">
        {byline ? `By ${byline} · ` : ""}
        {wordCount.toLocaleString("en-PH")} words · {readingMinutes(wordCount)}
      </p>
      <div className="mt-5 space-y-4 text-[0.975rem] leading-7">
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph[0].id}>
            {paragraph.map((sentence, index) => (
              <span key={sentence.id}>
                <span {...clickable(sentence)}>{sentence.text}</span>
                {index < paragraph.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        ))}
      </div>
      <footer className="mt-6 border-t pt-4">
        <p className="text-sm text-pretty text-muted-foreground italic">{shortCredit(content.credit)}</p>
        {cited.length > 0 && (
          <section className="mt-4" aria-labelledby="article-sources">
            <h3 id="article-sources" className="text-sm font-semibold">
              {sourcesHeading(language)}
            </h3>
            <ol className="mt-2 space-y-2.5">
              {cited.map((source, index) => (
                <li key={source.label} className="flex gap-2.5 text-sm">
                  <span className="tabular mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-primary/12 text-[11px] font-semibold text-primary">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-pretty">
                      {source.outlet_name}: {source.title}
                    </span>
                    <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-start gap-1 text-xs break-all text-primary underline-offset-2 hover:underline">
                      {readableUrl(source.url)} <ExternalLink className="mt-0.5 size-3 shrink-0" />
                    </a>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </footer>
    </article>
  );
}
