"use client";

import { useSyncExternalStore } from "react";
import { CLEAR_VIEW_CLASS, CLEAR_VIEW_KEY } from "@/lib/clear-view-script";

// Clear view: larger text, stronger contrast, no blur or see-through panels, and no motion.
// Saved per browser. The class is set before the page paints (see the script in the root layout).
const CHANGE_EVENT = "newsgen-clear-view-change";


function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useClearView(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains(CLEAR_VIEW_CLASS),
    () => false,
  );
  const set = (next: boolean) => {
    document.documentElement.classList.toggle(CLEAR_VIEW_CLASS, next);
    try {
      window.localStorage.setItem(CLEAR_VIEW_KEY, next ? "1" : "0");
    } catch {
      // The class still applies for this visit.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [on, set];
}
