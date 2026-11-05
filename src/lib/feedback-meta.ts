// Shared by server and browser code, so this file has no database imports.

export const FEEDBACK_STATUSES = [
  { id: "new", label: "New", hint: "Waiting for a developer to look at it", dot: "bg-sky-500" },
  { id: "accepted", label: "Accepted", hint: "Doable. Planned for a future update", dot: "bg-primary" },
  { id: "in_progress", label: "In progress", hint: "Being worked on now", dot: "bg-amber-500" },
  { id: "done", label: "Done", hint: "Fixed or built", dot: "bg-up" },
  { id: "not_doable", label: "Not doable", hint: "Will not be built. See the developer's note", dot: "bg-down" },
  { id: "duplicate", label: "Duplicate", hint: "Already reported in another task", dot: "bg-muted-foreground/50" },
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["id"];

export const FEEDBACK_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
] as const;

export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number]["id"];
export type FeedbackKind = "bug" | "feature";

/** Statuses that still need work. The sidebar counts these for admins. */
export const OPEN_STATUSES: FeedbackStatus[] = ["new", "accepted", "in_progress"];

export const taskKey = (number: number) => `NG-${number}`;

export function statusMeta(status: FeedbackStatus) {
  return FEEDBACK_STATUSES.find((s) => s.id === status) ?? FEEDBACK_STATUSES[0];
}

export type FeedbackItem = {
  id: string;
  number: number;
  kind: FeedbackKind;
  title: string;
  description: string;
  page: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  developer_note: string | null;
  reporter_id: string;
  reporter_name: string;
  created_at: string;
  updated_at: string;
  votes: number;
  voted: boolean;
  comment_count: number;
};

export type FeedbackComment = {
  id: string;
  author_id: string;
  author_name: string;
  author_is_admin: boolean;
  body: string;
  status_change: string | null;
  created_at: string;
};
