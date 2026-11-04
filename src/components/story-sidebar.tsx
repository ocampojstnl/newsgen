"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  DownloadCloud,
  FileText,
  Inbox,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Sun,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { initialsOf, useCurrentUser } from "@/components/current-user";
import { Logo } from "@/components/logo";
import { OutletAvatar } from "@/components/outlet-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/format";
import { pendingStage } from "@/lib/story-stage";
import { roleLabel } from "@/lib/user-roles";
import type { StoryListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;
const RECENT_LIMIT = 6;

type NavItem = { href: string; label: string; icon: React.ElementType; count?: number; exact?: boolean };

export const isActiveLink = (href: string, pathname: string, exact = false) =>
  href === "/" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/** The short list used by the top bar on small screens. */
export const NAV = [
  { href: "/", label: "News desk", icon: Radio },
  { href: "/stories", label: "My stories", icon: FileText },
];

function statusDot(story: StoryListItem): { className: string; label: string } {
  if (!story.is_owner) return { className: "bg-sky-500", label: `Shared by ${story.owner_name}` };
  if (story.approved_count > 0) return { className: "bg-up", label: "Has an approved version" };
  const stage = pendingStage(story);
  if (stage === "review") return { className: "bg-amber-500", label: "Versions to review" };
  if (stage === "article") return { className: "bg-down", label: "Needs the article text" };
  return { className: "bg-primary", label: "Ready to write" };
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = isActiveLink(item.href, pathname, item.exact);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group/nav relative flex h-9 items-center gap-2.5 rounded-lg text-sm transition-colors",
        collapsed ? "justify-center" : "px-2.5",
        active ? "font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
      )}
    >
      {active && (
        <motion.span layoutId="sidebar-nav-active" className="absolute inset-0 rounded-lg bg-sidebar-accent" transition={SPRING}>
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
        </motion.span>
      )}
      <item.icon className="relative size-4 shrink-0" />
      {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
      {!collapsed && item.count !== undefined && item.count > 0 && (
        <span className={cn("tabular relative rounded-md px-1.5 text-[11px]", active ? "bg-background/60" : "bg-muted")}>{item.count}</span>
      )}
      {collapsed && item.count !== undefined && item.count > 0 && (
        <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-primary" aria-hidden />
      )}
    </Link>
  );
}

function Section({ title, collapsed, children }: { title: string; collapsed: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      {collapsed ? (
        <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" aria-hidden />
      ) : (
        <p className="px-2.5 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">{title}</p>
      )}
      {children}
    </div>
  );
}

function RecentStory({ story, onDelete }: { story: StoryListItem; onDelete: (story: StoryListItem) => void }) {
  const pathname = usePathname();
  const active = pathname === `/stories/${story.id}`;
  const dot = statusDot(story);
  return (
    <motion.li layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16, height: 0 }} transition={{ duration: 0.18 }} className="group/row relative">
      <Link
        href={`/stories/${story.id}`}
        className={cn(
          "flex items-center gap-2.5 rounded-lg py-1.5 pr-8 pl-2.5 transition-colors",
          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
        )}
      >
        <span className="relative shrink-0">
          <OutletAvatar name={story.outlet_name ?? story.title} size={22} />
          <span className={cn("absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-sidebar", dot.className)} title={dot.label} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight">{story.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground" suppressHydrationWarning>
            {story.is_owner ? timeAgo(story.created_at) : `Shared by ${story.owner_name}`}
          </span>
        </span>
      </Link>
      {story.is_owner && (
        <button
          type="button"
          onClick={() => onDelete(story)}
          aria-label={`Delete story: ${story.title}`}
          title="Delete story"
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </motion.li>
  );
}

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const signOut = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent/60 data-popup-open:bg-sidebar-accent",
              collapsed && "justify-center",
            )}
          />
        }
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">{initialsOf(user.display_name)}</span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{user.display_name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                @{user.username} · {roleLabel(user)}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-sm font-medium text-foreground">{user.display_name}</span>
            <span className="block text-xs font-normal">@{user.username}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun /> : <Moon />} {dark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem render={<Link href="/admin/users" />}>
            <Users /> Manage users
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StorySidebar({
  stories,
  requestCount,
  collapsed = false,
  onToggleCollapsed,
  onDelete,
}: {
  stories: StoryListItem[];
  requestCount: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onDelete: (story: StoryListItem) => void;
}) {
  const user = useCurrentUser();
  const own = stories.filter((story) => story.is_owner);
  const shared = stories.filter((story) => !story.is_owner);
  const pending = own.filter((story) => pendingStage(story) !== null).length;
  const approved = stories.reduce((total, story) => total + story.approved_count, 0);
  const recent = stories.slice(0, RECENT_LIMIT);

  const workspace: NavItem[] = [
    { href: "/", label: "News desk", icon: Radio },
    { href: "/stories", label: "My stories", icon: FileText, count: own.length, exact: true },
    { href: "/pending", label: "Pending", icon: Clock, count: pending },
    { href: "/approved", label: "Approved", icon: CheckCircle2, count: approved },
    { href: "/shared", label: "Shared with me", icon: UsersRound, count: shared.length },
    { href: "/requests", label: "Requests", icon: Inbox, count: requestCount },
  ];
  const tools: NavItem[] = [
    { href: "/import", label: "Grab blocked articles", icon: DownloadCloud },
    ...(user.role === "admin" ? [{ href: "/admin/users", label: "Users", icon: Users }] : []),
  ];

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className={cn("flex items-center gap-2", collapsed ? "flex-col px-2 pt-4 pb-2" : "justify-between px-4 pt-4 pb-3")}>
        <Logo compact={collapsed} />
        {onToggleCollapsed && (
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="text-muted-foreground">
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </div>

      <div className={cn(collapsed ? "flex justify-center px-2" : "px-3")}>
        <Button
          size={collapsed ? "icon" : "default"}
          className={cn("group shadow-md shadow-primary/20", !collapsed && "w-full justify-start")}
          nativeButton={false}
          render={<Link href="/" aria-label={collapsed ? "New story" : undefined} title={collapsed ? "New story" : undefined} />}
        >
          <Plus className="transition-transform group-hover:rotate-90" />
          {!collapsed && "New story"}
        </Button>
      </div>

      <nav aria-label="Main" className={cn("thin-scroll min-h-0 flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}>
        <LayoutGroup id="sidebar-nav">
          <Section title="Workspace" collapsed={collapsed}>
            {workspace.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </Section>
          <Section title={user.role === "admin" ? "Tools & admin" : "Tools"} collapsed={collapsed}>
            {tools.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </Section>
        </LayoutGroup>

        {!collapsed && (
          <Section title="Recent" collapsed={false}>
            {recent.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">No stories yet. Click a headline on the News desk.</p>
            ) : (
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {recent.map((story) => (
                    <RecentStory key={story.id} story={story} onDelete={onDelete} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {stories.length > RECENT_LIMIT && (
              <Link href="/stories" className="block px-2.5 pt-1 text-xs font-medium text-primary hover:underline">
                View all {stories.length} stories
              </Link>
            )}
          </Section>
        )}
      </nav>

      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        <AccountMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
