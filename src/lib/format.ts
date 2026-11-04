const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 10 * 60 * 1000;

/** Some Philippine feeds label local time as UTC, which places new stories hours in the future. */
export function correctFutureDate(date: Date, now = Date.now()): Date {
  if (date.getTime() <= now + CLOCK_SKEW_MS) return date;
  const corrected = new Date(date.getTime() - MANILA_OFFSET_MS);
  return corrected.getTime() <= now + CLOCK_SKEW_MS ? corrected : new Date(now);
}

export function formatDateTime(value: string): string {
  return `${dateTime.format(new Date(value))} PHT`;
}

export function timeAgo(value: string | null): string {
  if (!value) return "";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
