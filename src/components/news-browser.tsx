"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, ClipboardPaste, EyeOff, FileText, Globe, Link2, Loader2, SlidersHorizontal, Newspaper, Radio, RefreshCw, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OutletAvatar } from "@/components/outlet-avatar";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES, isFromHiddenOutlet, OUTLETS, type CategoryId, type Outlet } from "@/lib/catalog";
import { useHiddenOutlets } from "@/lib/hidden-outlets";
import { timeAgo } from "@/lib/format";
import { grabArticle, saveGrabbedArticle, useExtensionInstalled } from "@/lib/grabber";
import type { FeedItem, OutletStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SELECTED = 6;
const PAGE_SIZE = 48;
const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;

export function NewsBrowser({ storyCount, approvedCount }: { storyCount: number; approvedCount: number }) {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [statuses, setStatuses] = useState<OutletStatus[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [outletId, setOutletId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Map<string, FeedItem>>(new Map());
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [outletsOpen, setOutletsOpen] = useState(false);
  const { hidden, setHidden } = useHiddenOutlets();
  const extensionInstalled = useExtensionInstalled();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/feeds");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data.items);
      setStatuses(data.statuses);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The news feeds could not be loaded.");
      setItems((current) => current ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Fetching on mount is the point of this effect: feeds load after the page shell appears.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const outletsInCategory = useMemo(
    () => OUTLETS.filter((o) => !hidden.has(o.id) && (category === "all" || o.category === category)),
    [category, hidden],
  );

  const shownItems = useMemo(() => (items ?? []).filter((item) => !isFromHiddenOutlet(item, hidden)), [items, hidden]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase();
    const allowed = new Set(outletsInCategory.map((o) => o.id));
    return shownItems.filter((item) => {
      if (!allowed.has(item.outletId)) return false;
      if (outletId && item.outletId !== outletId) return false;
      return !terms || `${item.title} ${item.summary} ${item.outletName}`.toLowerCase().includes(terms);
    });
  }, [shownItems, outletsInCategory, outletId, query]);

  const applyHidden = (next: Set<string>) => {
    setHidden(next);
    if (outletId && next.has(outletId)) setOutletId(null);
    // Ticked headlines from a hidden outlet would otherwise stay selected out of sight.
    setSelected((current) => new Map([...current].filter(([, item]) => !isFromHiddenOutlet(item, next))));
  };

  const hideOutlet = (outlet: Outlet) => {
    const before = new Set(hidden);
    applyHidden(new Set(hidden).add(outlet.id));
    toast(`${outlet.name} hidden`, { action: { label: "Undo", onClick: () => setHidden(before) } });
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items ?? []) map.set(item.outletId, (map.get(item.outletId) ?? 0) + 1);
    return map;
  }, [items]);

  const toggle = (item: FeedItem) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size >= MAX_SELECTED) toast.error(`A story can use up to ${MAX_SELECTED} sources.`);
      else next.set(item.id, item);
      return next;
    });
  };

  const chooseCategory = (next: CategoryId | "all") => {
    setCategory(next);
    setOutletId(null);
    setLimit(PAGE_SIZE);
  };

  const createStory = async (requests: { url: string; title?: string; outletId?: string; outletName?: string }[]) => {
    setCreating(true);
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: requests }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(`/stories/${data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The story could not be created.");
      setCreating(false);
      setOpeningId(null);
    }
  };

  const openItem = async (item: FeedItem) => {
    if (creating) return;
    setOpeningId(item.id);
    const request = { url: item.url, title: item.title, outletId: item.outletId, outletName: item.outletName };
    if (item.readable || !extensionInstalled) return createStory([request]);

    // This site blocks the server, so the extension reads it in the reporter's own browser.
    setCreating(true);
    try {
      const id = await saveGrabbedArticle(await grabArticle(item.url));
      router.push(`/stories/${id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The article could not be grabbed.");
      await createStory([request]);
    }
  };

  const shownStatuses = statuses.filter((s) => !hidden.has(s.outletId));
  const onlineCount = shownStatuses.filter((s) => s.ok).length;
  const failedOutlets = shownStatuses.filter((s) => !s.ok);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="size-3 text-primary" /> Philippine news, by outlet
          </div>
          <h1 className="text-gradient text-3xl font-bold tracking-tight sm:text-4xl">Your news desk</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Click a story to write versions of it. To combine reports of the same event, tick several and create one story.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
            <DialogTrigger render={<Button size="lg" className="shadow-lg shadow-primary/25" />}>
              <Link2 /> Add by link
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start from an article link</DialogTitle>
                <DialogDescription>
                  Use this for any news site. If the site does not allow automated reading, you can paste the text on the next screen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="manual-url">Article link</Label>
                <Input id="manual-url" type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="https://" />
              </div>
              <DialogFooter>
                <Button disabled={creating || !manualUrl.startsWith("http")} onClick={() => createStory([{ url: manualUrl.trim() }])}>
                  {creating && <Loader2 className="animate-spin" />} Start story
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="lg" variant="outline" onClick={load} disabled={refreshing} aria-label="Refresh news">
            <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Newspaper} label="Headlines loaded" value={shownItems.length} />
        <StatCard icon={Radio} label="Outlets online" value={onlineCount} suffix={shownStatuses.length ? ` / ${shownStatuses.length}` : ""} />
        <StatCard icon={FileText} label="Stories" value={storyCount} />
        <StatCard icon={ShieldCheck} label="Approved versions" value={approvedCount} />
      </section>

      <section className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search headlines"
            aria-label="Search headlines"
            className="h-10 bg-card/60 pl-9"
          />
        </div>
        <div className="thin-scroll flex gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="News category">
          <LayoutGroup id="category">
            {[{ id: "all" as const, name: "All sources" }, ...CATEGORIES].map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={category === option.id}
                onClick={() => chooseCategory(option.id)}
                className={cn(
                  "relative shrink-0 flex-1 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  category === option.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {category === option.id && <motion.span layoutId="category-pill" className="absolute inset-0 rounded-md bg-background shadow-sm" transition={SPRING} />}
                <span className="relative">{option.name}</span>
              </button>
            ))}
          </LayoutGroup>
        </div>
        <motion.div layout className="flex flex-wrap gap-1.5" aria-label="Outlets">
          <AnimatePresence initial={false}>
            {outletsInCategory.map((outlet) => {
              const active = outletId === outlet.id;
              return (
                <motion.span
                  layout
                  key={outlet.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.16 }}
                  className={cn(
                    "group/chip flex items-center rounded-md border text-xs transition-colors",
                    active ? "border-primary bg-primary/12 text-primary" : "bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setOutletId(active ? null : outlet.id);
                      setLimit(PAGE_SIZE);
                    }}
                    className="flex items-center gap-1.5 py-1 pl-1"
                  >
                    <OutletAvatar name={outlet.name} size={18} />
                    {outlet.name}
                    <span className="tabular text-[10px] opacity-70">{counts.get(outlet.id) ?? 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => hideOutlet(outlet)}
                    aria-label={`Hide ${outlet.name}`}
                    title={`Hide ${outlet.name}`}
                    className="mx-0.5 grid size-5 place-items-center rounded-sm opacity-40 transition-all group-hover/chip:opacity-100 hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100"
                  >
                    <EyeOff className="size-3" />
                  </button>
                </motion.span>
              );
            })}
          </AnimatePresence>
          <Dialog open={outletsOpen} onOpenChange={setOutletsOpen}>
            <DialogTrigger render={<Button variant="ghost" size="xs" className="h-[28px] text-muted-foreground" />}>
              <SlidersHorizontal /> {hidden.size > 0 ? `${hidden.size} hidden` : "Choose outlets"}
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Choose your outlets</DialogTitle>
                <DialogDescription>Hidden outlets disappear from your News desk, including through Google News. This is saved in this browser only.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {CATEGORIES.map((group) => (
                  <fieldset key={group.id} className="space-y-1.5">
                    <legend className="mb-1 text-xs font-medium text-muted-foreground">{group.name}</legend>
                    {OUTLETS.filter((outlet) => outlet.category === group.id).map((outlet) => (
                      <Label key={outlet.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border p-2 font-normal transition-colors hover:border-primary/40">
                        <Checkbox
                          checked={!hidden.has(outlet.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(hidden);
                            if (checked === true) next.delete(outlet.id);
                            else next.add(outlet.id);
                            applyHidden(next);
                          }}
                        />
                        <OutletAvatar name={outlet.name} size={22} />
                        {outlet.name}
                      </Label>
                    ))}
                  </fieldset>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setHidden([])} disabled={hidden.size === 0}>
                  Show all outlets
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </section>

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {failedOutlets.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not available right now: {failedOutlets.map((s) => OUTLETS.find((o) => o.id === s.outletId)?.name).join(", ")}
        </p>
      )}

      <section className="pb-20">
        {items === null ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No stories match this filter.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.slice(0, limit).map((item, index) => {
              const checked = selected.has(item.id);
              return (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "group relative flex cursor-pointer flex-col rounded-lg border bg-card/70 p-4 backdrop-blur transition-colors",
                    checked ? "border-primary bg-primary/8" : "hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <OutletAvatar name={item.outletName} size={24} />
                    <span className="min-w-0 truncate font-medium">{item.outletName}</span>
                    <span className="shrink-0 text-muted-foreground" suppressHydrationWarning>
                      {timeAgo(item.publishedAt)}
                    </span>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Select: ${item.title}`}
                      onClick={() => toggle(item)}
                      className={cn(
                        "relative z-10 ml-auto grid size-6 shrink-0 place-items-center rounded-md border bg-card transition-colors",
                        checked ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary hover:bg-primary/10",
                      )}
                    >
                      <AnimatePresence initial={false}>
                        {checked && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 28 }}>
                            <Check className="size-3.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                  {/* The ::after layer stretches this button over the card, so the whole card opens the story. */}
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    disabled={creating}
                    className="mt-3 block text-left font-semibold leading-snug tracking-tight text-pretty transition-colors after:absolute after:inset-0 after:rounded-lg group-hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {item.title}
                  </button>
                  {item.summary && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>}
                  {!item.readable && (
                    <Badge variant="outline" className="mt-3 w-fit gap-1">
                      {extensionInstalled ? <Globe className="size-3" /> : <ClipboardPaste className="size-3" />}
                      {extensionInstalled ? "Opens in your browser" : "Paste text"}
                    </Badge>
                  )}
                  <AnimatePresence>
                    {openingId === item.id && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex items-center justify-center gap-2 rounded-lg bg-card/90 text-sm font-medium backdrop-blur-sm"
                      >
                        <Loader2 className="size-4 animate-spin text-primary" /> Opening story
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        )}
        {visible.length > limit && (
          <div className="mt-5 flex justify-center">
            <Button variant="outline" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
              Show more ({visible.length - limit} left)
            </Button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="sticky bottom-4 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-lg border bg-popover/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            <p className="min-w-40 flex-1 text-sm">
              <strong>{selected.size}</strong> {selected.size === 1 ? "article" : "articles"} selected.{" "}
              <span className="text-muted-foreground">
                {selected.size === 1 ? "Add another outlet to corroborate." : "Pick reports about the same event."}
              </span>
            </p>
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              <X /> Clear
            </Button>
            <Button
              disabled={creating}
              className="shadow-lg shadow-primary/25"
              onClick={() =>
                createStory([...selected.values()].map((i) => ({ url: i.url, title: i.title, outletId: i.outletId, outletName: i.outletName })))
              }
            >
              {creating && <Loader2 className="animate-spin" />} {creating ? "Capturing articles" : "Create story"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
