"use client";

import { DownloadCloud, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { captureLabel } from "@/lib/evidence";
import { formatDateTime } from "@/lib/format";
import { grabArticle, saveGrabbedArticle, useExtensionInstalled } from "@/lib/grabber";
import type { PendingSource, Source } from "@/lib/types";

async function postSource(storyId: string, body: object) {
  const response = await fetch(`/api/stories/${storyId}/sources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data as { source: Source; pending: PendingSource[] };
}

function PasteForm({
  storyId,
  pending,
  onAdded,
}: {
  storyId: string;
  pending: PendingSource;
  onAdded: (source: Source, pending: PendingSource[]) => void;
}) {
  const needsRealLink = pending.url.includes("news.google.com");
  const [url, setUrl] = useState(needsRealLink ? "" : pending.url);
  const [title, setTitle] = useState(pending.title === pending.url ? "" : pending.title);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const extensionInstalled = useExtensionInstalled();
  const router = useRouter();

  const grab = async () => {
    setGrabbing(true);
    try {
      const article = await grabArticle(pending.url);
      await saveGrabbedArticle(article, { storyId, pendingUrl: pending.url });
      // The server has the new source and facts, so reload this story's data.
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The article could not be grabbed.");
      setGrabbing(false);
      router.refresh();
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const result = await postSource(storyId, {
        url: url.trim(),
        title: title.trim(),
        outletId: pending.outletId,
        pastedText: text,
        replacesPendingUrl: pending.url,
      });
      onAdded(result.source, result.pending);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The source could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{pending.title}</CardTitle>
        <CardDescription>
          {pending.outletName}: {pending.reason}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {extensionInstalled ? (
            <Button className="shadow-lg shadow-primary/25" onClick={grab} disabled={grabbing}>
              {grabbing ? <Loader2 className="animate-spin" /> : <DownloadCloud />} {grabbing ? "Grabbing article" : "Grab article"}
            </Button>
          ) : (
            <Button className="shadow-lg shadow-primary/25" nativeButton={false} render={<Link href="/import" />}>
              <DownloadCloud /> Set up one-click grabbing
            </Button>
          )}
          <Button variant="outline" nativeButton={false} render={<a href={pending.url} target="_blank" rel="noreferrer" />}>
            Open the article <ExternalLink />
          </Button>
        </div>
        <details className="group rounded-md border bg-background/40 p-3">
          <summary className="cursor-pointer text-sm font-medium">Or paste it by hand</summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`url-${pending.url}`}>Original article link</Label>
                <Input
                  id={`url-${pending.url}`}
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                />
                {needsRealLink && (
                  <p className="text-xs text-muted-foreground">
                    Open the article, then copy the link from your browser&apos;s address bar.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`title-${pending.url}`}>Headline</Label>
                <Input id={`title-${pending.url}`} value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`text-${pending.url}`}>Article text</Label>
              <Textarea
                id={`text-${pending.url}`}
                rows={8}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste only the article's paragraphs."
              />
            </div>
            <Button onClick={submit} disabled={saving || !url.startsWith("http") || !title.trim() || !text.trim()}>
              {saving && <Loader2 className="animate-spin" />} Save source
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function SourcesPanel({
  storyId,
  sources,
  pending,
  readOnly = false,
  onAdded,
}: {
  storyId: string;
  sources: Source[];
  pending: PendingSource[];
  readOnly?: boolean;
  onAdded: (source: Source, pending: PendingSource[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState<PendingSource | null>(null);

  const addLink = async () => {
    setAdding(true);
    try {
      const result = await postSource(storyId, { url: url.trim() });
      onAdded(result.source, result.pending);
      setUrl("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "That article could not be read.";
      toast.error(reason);
      setManual({
        url: url.trim(),
        title: url.trim(),
        outletId: null,
        outletName: "This site",
        reason,
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <Alert>
          <AlertTitle>{pending.length === 1 ? "1 article needs" : `${pending.length} articles need`} grabbing</AlertTitle>
          <AlertDescription>
            These sites block the NewsGen server, but they open normally in your browser. Grab each one from there, or paste its text.
          </AlertDescription>
        </Alert>
      )}
      {pending.map((item) => (
        <PasteForm key={item.url} storyId={storyId} pending={item} onAdded={onAdded} />
      ))}
      {manual && (
        <PasteForm
          key={manual.url}
          storyId={storyId}
          pending={manual}
          onAdded={(source, next) => {
            setManual(null);
            setUrl("");
            onAdded(source, next);
          }}
        />
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="add-source">Add another article</Label>
            <Input id="add-source" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
          </div>
          <Button onClick={addLink} disabled={adding || !url.startsWith("http")}>
            {adding && <Loader2 className="animate-spin" />} Add source
          </Button>
        </div>
      )}

      {sources.map((source) => (
        <details key={source.id} className="rounded-lg border bg-card/70 p-4 backdrop-blur">
          <summary className="cursor-pointer">
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge variant="outline">{source.label}</Badge>
              <span className="font-medium">{source.outlet_name}</span>
              {source.capture_method !== "page" && <Badge variant="secondary">{captureLabel(source.capture_method)}</Badge>}
            </span>
            <span className="mt-1 block text-base leading-snug font-semibold tracking-tight">{source.title}</span>
          </summary>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              <a href={source.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {source.url}
              </a>
            </p>
            {source.author && <p>By {source.author}</p>}
            {source.published_at && <p>Published {formatDateTime(source.published_at)}</p>}
            <p>Captured {formatDateTime(source.fetched_at)}</p>
            <p className="break-all">SHA-256 {source.content_sha256}</p>
          </div>
          <ol className="mt-4 space-y-2 text-sm">
            {source.paragraphs.map((paragraph, index) => (
              <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-1">
                <span className="text-xs text-muted-foreground tabular-nums">¶{index + 1}</span>
                <span>{paragraph}</span>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
