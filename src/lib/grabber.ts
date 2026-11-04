import { useSyncExternalStore } from "react";
import type { ImportedArticle } from "@/lib/import";

const GRAB_TIMEOUT_MS = 70_000;

/** True when the NewsGen browser extension is installed in this browser. */
export function useExtensionInstalled(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => document.documentElement.dataset.newsgenExtension === "1",
    () => false,
  );
}

/** Asks the extension to open one article in this browser and return its text. */
export function grabArticle(url: string): Promise<ImportedArticle> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const finish = (action: () => void) => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      action();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== "newsgen-extension" || event.data.id !== id) return;
      const { article, error } = event.data.result ?? {};
      finish(() => (article ? resolve(article) : reject(new Error(error ?? "The article could not be read."))));
    };
    const timer = window.setTimeout(() => finish(() => reject(new Error("Grabbing the article took too long."))), GRAB_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "newsgen-page", type: "grab", id, url }, window.location.origin);
  });
}

/** Saves a grabbed article, into a given story or into a new one. Returns the story id. */
export async function saveGrabbedArticle(article: ImportedArticle, target?: { storyId: string; pendingUrl: string }): Promise<string> {
  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...article, ...target }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data.id;
}
