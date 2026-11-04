"use client";

import { motion } from "motion/react";
import { BookmarkPlus, Check, CheckCircle2, Copy, ExternalLink, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { OutletAvatar } from "@/components/outlet-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { readableUrl } from "@/lib/evidence";
import { useExtensionInstalled } from "@/lib/grabber";
import { bookmarkletCode, parseImportHash, type ImportedArticle } from "@/lib/import";

const STEPS = [
  "Show your browser's bookmarks bar (Ctrl+Shift+B).",
  "Drag the Send to NewsGen button below onto the bookmarks bar.",
  "Open any news article, then click the bookmark.",
];

function ExtensionGuide({ folder }: { folder: string }) {
  const installed = useExtensionInstalled();
  const copy = async () => {
    await navigator.clipboard.writeText(folder);
    toast.success("Folder path copied.");
  };

  if (installed) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>One-click grabbing is on</AlertTitle>
        <AlertDescription>Click any story on the News desk. Blocked sites open in a tab, the text is captured, and you land on the versions form.</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Recommended: one-click extension</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a story and the article opens in this browser, its text comes back, and the tab closes. It only runs when you click, one article at a time. Works in Chrome and Edge. It can read pages you open through it, and it only sends text back to NewsGen.
        </p>
      </div>
      <ol className="space-y-2 text-sm">
        <li className="rounded-lg border bg-card/70 p-3 backdrop-blur">
          <strong>1.</strong> Open <code className="rounded bg-muted px-1">chrome://extensions</code> (or <code className="rounded bg-muted px-1">edge://extensions</code>) in a new tab.
        </li>
        <li className="rounded-lg border bg-card/70 p-3 backdrop-blur">
          <strong>2.</strong> Turn on <strong>Developer mode</strong>.
        </li>
        <li className="rounded-lg border bg-card/70 p-3 backdrop-blur">
          <strong>3.</strong> Click <strong>Load unpacked</strong> and choose this folder:
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs break-all">{folder}</code>
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy /> Copy path
            </Button>
          </span>
        </li>
        <li className="rounded-lg border bg-card/70 p-3 backdrop-blur">
          <strong>4.</strong> Reload this page. It will confirm that grabbing is on.
        </li>
      </ol>
    </section>
  );
}

function InstallGuide() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    const value = bookmarkletCode(window.location.origin);
    // React refuses javascript: links in props, and a bookmark needs one, so it is set directly.
    linkRef.current?.setAttribute("href", value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(value);
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Copied. Create a new bookmark and paste this as its address.");
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Alternative: bookmark button</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Needs no extension. It takes the article you already have open and brings its link, headline and text here.
        </p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <motion.li key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="flex gap-3 rounded-lg border bg-card/70 p-3 text-sm backdrop-blur">
            <span className="tabular grid size-6 shrink-0 place-items-center rounded-md bg-primary/12 text-xs font-semibold text-primary">{index + 1}</span>
            {step}
          </motion.li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <a
          ref={linkRef}
          draggable
          onClick={(event) => {
            event.preventDefault();
            toast.info("Drag this button to your bookmarks bar instead of clicking it.");
          }}
          className="inline-flex cursor-grab items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 active:cursor-grabbing"
        >
          <BookmarkPlus className="size-4" /> Send to NewsGen
        </a>
        <Button variant="outline" onClick={copy} disabled={!code}>
          <Copy /> Copy bookmark code
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">If dragging does not work, use the copy button and paste the code as the address of a new bookmark.</p>
    </section>
  );
}

function ConfirmImport({ article }: { article: ImportedArticle }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const words = article.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  const host = new URL(article.url).hostname.replace(/^www\./, "");
  const tooShort = words < 40;

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(article),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.history.replaceState(null, "", "/import");
      router.push(`/stories/${data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The article could not be saved.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-gradient text-3xl font-bold tracking-tight">Use this article?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Check that this is the article you meant to send, and that the text is complete.</p>
      </div>
      <div className="rounded-lg border bg-card/70 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <OutletAvatar name={host} size={24} />
          <span className="font-medium">{host}</span>
          <span className="text-muted-foreground">{words.toLocaleString("en-PH")} words</span>
        </div>
        <h2 className="mt-3 text-lg leading-snug font-bold tracking-tight text-pretty">{article.title}</h2>
        <a href={article.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-start gap-1 text-xs break-all text-primary hover:underline">
          {readableUrl(article.url)} <ExternalLink className="mt-0.5 size-3 shrink-0" />
        </a>
        <div className="thin-scroll mt-4 max-h-80 space-y-3 overflow-y-auto border-t pt-4 text-sm leading-6">
          {article.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
      {tooShort && (
        <Alert variant="destructive">
          <AlertTitle>Very little text was found</AlertTitle>
          <AlertDescription>This page may not be an article, or it may still be loading. Reload the article and send it again, or paste the text into the story instead.</AlertDescription>
        </Alert>
      )}
      <Button size="lg" className="shadow-lg shadow-primary/25" onClick={save} disabled={saving || tooShort}>
        {saving ? <Loader2 className="animate-spin" /> : <Check />} Use this article
      </Button>
    </div>
  );
}

export function ImportArticle({ extensionFolder }: { extensionFolder: string }) {
  const [state, setState] = useState<{ ready: boolean; article: ImportedArticle | null; invalid: boolean }>({ ready: false, article: null, invalid: false });

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash;
      setState({ ready: true, article: parseImportHash(hash), invalid: hash.length > 1 && !parseImportHash(hash) });
    };
    // The fragment only exists in the browser, so it can only be read after the page loads.
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      {state.invalid && (
        <Alert variant="destructive">
          <Send />
          <AlertTitle>That link did not contain a readable article</AlertTitle>
          <AlertDescription>Open the article and click the bookmark again.</AlertDescription>
        </Alert>
      )}
      {state.ready &&
        (state.article ? (
          <ConfirmImport article={state.article} />
        ) : (
          <div className="max-w-2xl space-y-8">
            <div>
              <h1 className="text-gradient text-3xl font-bold tracking-tight">Grab blocked articles</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                ABS-CBN, TV5, Inquirer and Manila Bulletin block the NewsGen server, but they open normally in your own browser. Either tool below reads the article from there.
              </p>
            </div>
            <ExtensionGuide folder={extensionFolder} />
            <InstallGuide />
          </div>
        ))}
    </div>
  );
}
