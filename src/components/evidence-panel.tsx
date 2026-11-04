"use client";

import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { captureLabel, evidenceLink } from "@/lib/evidence";
import { formatDateTime } from "@/lib/format";
import { findOutletNames } from "@/lib/outlet-names";
import type { LegalFlag, PublicSource, Sentence, SentenceReview, Source } from "@/lib/types";

const VERDICTS = {
  supported: { label: "Supported by the cited text", Icon: CheckCircle2, className: "text-up" },
  partial: { label: "Partly supported, check this", Icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
  unsupported: { label: "Not supported, fix or remove", Icon: XCircle, className: "text-destructive" },
};

export function EvidencePanel({
  sentence,
  sources,
  review,
  flags,
}: {
  sentence: Sentence | null;
  sources: (PublicSource | Source)[];
  review?: SentenceReview;
  flags?: LegalFlag[];
}) {
  if (!sentence) {
    return (
      <div className="rounded-lg border border-dashed bg-card/40 p-5 text-sm text-muted-foreground backdrop-blur">
        <FileSearch className="mb-2 size-5 text-primary" />
        <p className="font-medium text-foreground">Evidence</p>
        <p className="mt-1">Select any sentence to see exactly which passage of which article it came from.</p>
      </div>
    );
  }

  const outlets = new Set(
    sentence.evidence.map((e) => sources.find((s) => s.label === e.source)?.outlet_name).filter(Boolean),
  );
  const verdict = review ? VERDICTS[review.verdict] : null;

  return (
    <motion.div
      key={sentence.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-3 rounded-lg border bg-card/80 p-4 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Evidence</p>
        <Badge variant={outlets.size > 1 ? "default" : "outline"}>
          {outlets.size > 1 ? `Reported by ${outlets.size} outlets` : "Single outlet"}
        </Badge>
      </div>

      {verdict && review && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className={`flex items-center gap-1.5 font-medium ${verdict.className}`}>
            <verdict.Icon className="size-4 shrink-0" /> {verdict.label}
          </p>
          {review.note && <p className="mt-1 text-muted-foreground">{review.note}</p>}
          {review.unmatchedNumbers.length > 0 && (
            <p className="mt-2 text-amber-700 dark:text-amber-400">
              Figure not found in the cited text: {review.unmatchedNumbers.join(", ")}
            </p>
          )}
          {review.unverifiedQuotes.map((quote) => (
            <p key={quote} className="mt-2 text-destructive">
              Quotation not found word for word: &ldquo;{quote}&rdquo;
            </p>
          ))}
          {findOutletNames(sentence.text).length > 0 && (
            <p className="mt-2 text-amber-700 dark:text-amber-400">Names a news outlet: {findOutletNames(sentence.text).join(", ")}</p>
          )}
          {review.copiedPhrase && (
            <p className="mt-2 text-amber-700 dark:text-amber-400">
              Same wording as a source: &ldquo;{review.copiedPhrase}&rdquo;. Reword it or quote and attribute it.
            </p>
          )}
        </div>
      )}

      {flags?.map((flag) => (
        <div key={`${flag.type}-${flag.explanation}`} className="rounded-md border border-destructive/30 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <ShieldAlert className="size-4 shrink-0" /> Legal risk: {flag.type.replaceAll("_", " ")}
          </p>
          <p className="mt-1">{flag.explanation}</p>
          <p className="mt-1 text-muted-foreground">Suggestion: {flag.suggestion}</p>
        </div>
      ))}

      {sentence.evidence.length === 0 && <p className="text-sm text-destructive">No source passage backs this sentence.</p>}

      {sentence.evidence.map((item) => {
        const source = sources.find((s) => s.label === item.source);
        const fullParagraph =
          // Public article-only links send paragraphs as null, so check for real text.
          source && "paragraphs" in source && Array.isArray(source.paragraphs) ? (source.paragraphs[item.paragraph - 1] ?? null) : null;
        return (
          <div key={`${item.source}-${item.paragraph}-${item.quote}`} className="border-t pt-3 text-sm">
            <p className="font-medium">{source?.outlet_name ?? item.source}</p>
            {source && <p className="text-xs text-muted-foreground">{source.title}</p>}
            <blockquote className="mt-2 border-l-2 border-primary pl-3 font-heading italic">{item.quote}</blockquote>
            <p className="mt-2 text-xs text-muted-foreground">Paragraph {item.paragraph} of the article</p>
            {fullParagraph && fullParagraph !== item.quote && (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show the full captured paragraph</summary>
                <p className="mt-1">{fullParagraph}</p>
              </details>
            )}
            {source && (
              <>
                <a
                  href={evidenceLink(source.url, item.quote)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Open at this passage <ExternalLink className="size-3" />
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {captureLabel(source.capture_method)}, {formatDateTime(source.fetched_at)}
                </p>
              </>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
