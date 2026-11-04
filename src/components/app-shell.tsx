"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ClearViewToggle } from "@/components/clear-view-toggle";
import { CurrentUserProvider } from "@/components/current-user";
import { Logo } from "@/components/logo";
import { isActiveLink, NAV, StorySidebar } from "@/components/story-sidebar";
import { Button } from "@/components/ui/button";
import type { SessionUser, StoryListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE = "newsgen_sidebar";
const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;
const UNDO_MS = 6000;
// The sidebar picks up stories other people share, and their changes, at this pace.
const SIDEBAR_REFRESH_MS = 30_000;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  const icon = { type: "spring", stiffness: 400, damping: 22 } as const;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="relative grid size-4 place-items-center">
        <motion.span
          className="absolute inset-0 grid place-items-center"
          initial={false}
          animate={dark ? { opacity: 0, rotate: 90, scale: 0.5 } : { opacity: 1, rotate: 0, scale: 1 }}
          transition={icon}
        >
          <Sun className="size-4" />
        </motion.span>
        <motion.span
          className="absolute inset-0 grid place-items-center"
          initial={false}
          animate={dark ? { opacity: 1, rotate: 0, scale: 1 } : { opacity: 0, rotate: -90, scale: 0.5 }}
          transition={icon}
        >
          <Moon className="size-4" />
        </motion.span>
      </span>
    </Button>
  );
}

function pageTitle(pathname: string): string {
  if (pathname === "/") return "News desk";
  if (pathname === "/stories") return "My stories";
  if (pathname === "/pending") return "Pending";
  if (pathname === "/shared") return "Shared with me";
  if (pathname === "/requests") return "Requests";
  if (pathname === "/admin/users") return "Users";
  if (pathname === "/approved") return "Approved";
  if (pathname === "/import") return "Grab blocked articles";
  return pathname.startsWith("/stories/") ? "Story" : "";
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const title = pageTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/70 px-3 backdrop-blur-xl sm:px-4">
      <Button variant="ghost" size="icon-sm" onClick={onOpenMenu} aria-label="Open menu" className="lg:hidden">
        <Menu />
      </Button>
      <div className="lg:hidden">
        <Logo compact />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="truncate text-sm font-semibold"
        >
          {title}
        </motion.span>
      </AnimatePresence>
      <nav className="ml-auto flex items-center gap-0.5" aria-label="Quick links">
        {/* The sidebar has these links on wide screens. */}
        <div className="flex items-center gap-0.5 lg:hidden">
          <LayoutGroup id="quick">
            {NAV.map((item) => {
              const active = isActiveLink(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span layoutId="quick-active" className="absolute inset-0 rounded-md bg-primary/12" transition={SPRING} />
                  )}
                  <item.icon className="relative size-4" />
                </Link>
              );
            })}
          </LayoutGroup>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        </div>
        <ClearViewToggle />
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function AppShell({
  children,
  user,
  stories,
  requestCount,
  initialCollapsed,
}: {
  children: React.ReactNode;
  user: SessionUser;
  requestCount: number;
  stories: StoryListItem[];
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, SIDEBAR_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  // Close the mobile drawer after navigating.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsedState(next);
    // A cookie lets the server render the right width on the first paint.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  const setHidden = (id: string, hidden: boolean) =>
    setHiddenIds((current) => {
      const next = new Set(current);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  /** The story disappears at once and is only really deleted when the undo window ends. */
  const deleteStory = (story: StoryListItem) => {
    setHidden(story.id, true);
    if (pathname === `/stories/${story.id}`) router.push("/stories");

    const timer = setTimeout(async () => {
      const response = await fetch(`/api/stories/${story.id}`, {
        method: "DELETE",
      }).catch(() => null);
      if (response?.ok) {
        router.refresh();
      } else {
        setHidden(story.id, false);
        toast.error("The story could not be deleted.");
      }
    }, UNDO_MS);

    toast(`Deleted "${story.title.length > 48 ? `${story.title.slice(0, 48)}...` : story.title}"`, {
      description: "Its sources, versions and shared links go with it.",
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timer);
          setHidden(story.id, false);
        },
      },
    });
  };

  const visibleStories = stories.filter((story) => !hiddenIds.has(story.id));

  return (
    <CurrentUserProvider value={user}>
      <div className="flex h-dvh overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-16" : "w-72",
          )}
        >
          <StorySidebar stories={visibleStories} requestCount={requestCount} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onDelete={deleteStory} />
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-80 border-r bg-sidebar shadow-2xl lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-3 right-3 z-10"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X />
                </Button>
                <StorySidebar stories={visibleStories} requestCount={requestCount} onDelete={deleteStory} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMenu={() => setMobileOpen(true)} />
          <main className="bg-glow thin-scroll relative min-h-0 flex-1 overflow-y-auto">
            <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-80" aria-hidden />
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </CurrentUserProvider>
  );
}
