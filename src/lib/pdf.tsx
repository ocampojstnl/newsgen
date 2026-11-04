import path from "node:path";
import { Document, Font, Link, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { allSentences, captureLabel, citedSources, evidenceLink, readableUrl, shortCredit, sourcesHeading } from "@/lib/evidence";
import { formatDateTime } from "@/lib/format";
import { readingMinutes } from "@/lib/options";
import type { PublicSource, VersionContent } from "@/lib/types";

const fontDir = path.join(process.cwd(), "src", "assets", "fonts");

Font.register({
  family: "NotoSerif",
  fonts: [
    { src: path.join(fontDir, "NotoSerif-Regular.ttf") },
    { src: path.join(fontDir, "NotoSerif-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(fontDir, "NotoSerif-Italic.ttf"), fontStyle: "italic" },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSerif", fontSize: 10.5, lineHeight: 1.55, padding: 54, color: "#1c1917" },
  headline: { fontSize: 22, fontWeight: "bold", lineHeight: 1.25, marginBottom: 8 },
  dek: { fontSize: 12.5, color: "#44403c", marginBottom: 10 },
  meta: { fontSize: 9, color: "#57534e", marginBottom: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#d6d3d1", marginVertical: 12 },
  paragraph: { marginBottom: 9 },
  credit: { fontSize: 9, fontStyle: "italic", color: "#44403c", marginTop: 6 },
  sourcesHeading: { fontSize: 10.5, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  sourceRow: { marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  sectionIntro: { fontSize: 9, color: "#57534e", marginBottom: 10 },
  block: { marginBottom: 10 },
  sourceTitle: { fontSize: 9.5, fontWeight: "bold" },
  small: { fontSize: 8.5, color: "#44403c" },
  link: { fontSize: 8.5, color: "#7f1d1d" },
  claim: { fontSize: 9.5, fontWeight: "bold", marginBottom: 2 },
  quote: { fontSize: 8.5, fontStyle: "italic", color: "#44403c" },
  footer: { position: "absolute", bottom: 26, left: 54, right: 54, fontSize: 7.5, color: "#78716c", textAlign: "center" },
});

/** Breaks long links at fixed points, so the PDF never adds a hyphen that would change the printed address. */
function printedUrl(url: string): string {
  return (readableUrl(url).match(/.{1,80}/gu) ?? [url]).join("\n");
}

export type PdfInput = {
  content: VersionContent;
  byline: string | null;
  reviewedAt: string | null;
  wordCount: number;
  language: string;
  sources: PublicSource[];
};

function VersionPdf({ content, byline, reviewedAt, wordCount, language, sources }: PdfInput) {
  const outletOf = (label: string) => sources.find((s) => s.label === label);
  return (
    <Document title={content.headline.text} author={byline ?? undefined} creator="NewsGen" producer="NewsGen">
      <Page size="A4" style={styles.page}>
        <Text style={styles.headline}>{content.headline.text}</Text>
        {content.dek && <Text style={styles.dek}>{content.dek.text}</Text>}
        {byline && <Text style={styles.meta}>By {byline}</Text>}
        <Text style={styles.meta}>
          {wordCount.toLocaleString("en-PH")} words, {readingMinutes(wordCount)}
          {reviewedAt ? `. Approved by the reporter ${formatDateTime(reviewedAt)}` : ""}
        </Text>
        <View style={styles.rule} />
        {content.paragraphs.map((paragraph) => (
          <Text key={paragraph[0].id} style={styles.paragraph}>
            {paragraph.map((s) => s.text).join(" ")}
          </Text>
        ))}
        <Text style={styles.credit}>{shortCredit(content.credit)}</Text>
        <Text style={styles.sourcesHeading}>{sourcesHeading(language)}</Text>
        {citedSources(content, sources).map((source, index) => (
          <View key={source.label} style={styles.sourceRow} wrap={false}>
            <Text style={styles.sourceTitle}>
              {index + 1}. {source.outlet_name}: {source.title}
            </Text>
            <Link src={source.url} style={styles.link}>
              {printedUrl(source.url)}
            </Link>
          </View>
        ))}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Capture records</Text>
        <Text style={styles.sectionIntro}>
          The article text used as evidence was captured at the time shown. The SHA-256 fingerprint identifies the exact captured text.
        </Text>
        {sources.map((source) => (
          <View key={source.label} style={styles.block} wrap={false}>
            <Text style={styles.sourceTitle}>
              [{source.label}] {source.outlet_name}: {source.title}
            </Text>
            <Link src={source.url} style={styles.link}>
              {printedUrl(source.url)}
            </Link>
            <Text style={styles.small}>
              {captureLabel(source.capture_method)} on{" "}
              {formatDateTime(source.fetched_at)}
              {source.published_at ? `. Published ${formatDateTime(source.published_at)}` : ""}
            </Text>
            <Text style={styles.small}>SHA-256: {source.content_sha256}</Text>
          </View>
        ))}

        <View style={styles.rule} />
        <Text style={styles.sectionTitle}>Evidence for each sentence</Text>
        <Text style={styles.sectionIntro}>Each passage is quoted from the captured source. Links open at that passage in most browsers.</Text>
        {allSentences(content).map((sentence) => (
          <View key={sentence.id} style={styles.block}>
            <Text style={styles.claim}>{sentence.text}</Text>
            {sentence.evidence.map((item) => {
              const source = outletOf(item.source);
              return (
                <View key={`${item.source}-${item.paragraph}-${item.quote}`} wrap={false}>
                  <Text style={styles.quote}>&ldquo;{item.quote}&rdquo;</Text>
                  {source && (
                    <Link src={evidenceLink(source.url, item.quote)} style={styles.link}>
                      {item.source}, paragraph {item.paragraph}, {source.outlet_name}
                    </Link>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

export async function pdfResponse(input: PdfInput): Promise<Response> {
  const buffer = await renderToBuffer(<VersionPdf {...input} />);
  const slug = input.content.headline.text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${slug || "news-article"}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
