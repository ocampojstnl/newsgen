import { useCallback, useMemo, useSyncExternalStore } from "react";

// Saved per browser, so each reporter keeps their own choices under the shared password.
const STORAGE_KEY = "newsgen-hidden-outlets";
const CHANGE_EVENT = "newsgen-hidden-outlets-change";

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function parseHiddenOutlets(raw: string): Set<string> {
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function useHiddenOutlets() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const hidden = useMemo(() => parseHiddenOutlets(raw), [raw]);

  const setHidden = useCallback((ids: Iterable<string>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // Without browser storage the choice cannot be kept.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { hidden, setHidden };
}
