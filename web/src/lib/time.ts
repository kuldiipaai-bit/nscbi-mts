import type { Activity } from "./types";

export type ActivityState = "upcoming" | "running" | "past";

/** "06:00:00" -> "06:00" */
export function fmtTime(t: string): string {
  return t.slice(0, 5);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local date as YYYY-MM-DD (not UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

export function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(ts: string): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** True when the activity ends after midnight (end <= start). */
export function crossesMidnight(start: string, end: string): boolean {
  return end.slice(0, 5) <= start.slice(0, 5);
}

/** Absolute [start, end) window of an activity as Date objects (local time). */
export function activityWindow(a: Pick<Activity, "activity_date" | "start_time" | "end_time">): {
  start: Date;
  end: Date;
} {
  const [y, m, d] = a.activity_date.split("-").map(Number);
  const [sh, sm] = a.start_time.split(":").map(Number);
  const [eh, em] = a.end_time.split(":").map(Number);
  const start = new Date(y, m - 1, d, sh, sm, 0);
  const end = new Date(y, m - 1, d, eh, em, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

export function activityState(
  a: Pick<Activity, "activity_date" | "start_time" | "end_time">,
  now: Date = new Date(),
): ActivityState {
  const { start, end } = activityWindow(a);
  if (now < start) return "upcoming";
  if (now >= end) return "past";
  return "running";
}

/**
 * Activities to show for a calendar day: those dated that day, plus the previous
 * day's activities that run past midnight into it.
 */
export function visibleOnDay<T extends Pick<Activity, "activity_date" | "start_time" | "end_time">>(
  list: T[],
  day: string,
): T[] {
  const prev = addDays(day, -1);
  return list
    .filter(
      (a) =>
        a.activity_date === day ||
        (a.activity_date === prev && crossesMidnight(a.start_time, a.end_time)),
    )
    .sort((a, b) => {
      const wa = activityWindow(a).start.getTime();
      const wb = activityWindow(b).start.getTime();
      return wa - wb;
    });
}
