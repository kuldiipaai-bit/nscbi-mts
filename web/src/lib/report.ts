import type { Priority } from "./types";

export interface ReportActivity {
  id: string;
  title: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  priority: Priority;
  services: { name: string; owner_me_id?: string | null } | null;
  observations: { id: string; status: "open" | "resolved" }[];
}

export interface ServiceRow {
  name: string;
  total: number;
  monitored: number;
  notMonitored: number;
  open: number;
}

export interface ReportSummary {
  total: number;
  monitored: number;
  notMonitored: number;
  percent: number; // 0-100, whole number
  open: number;
  resolved: number;
  criticalWithOpen: number;
  unmonitoredCritical: ReportActivity[];
  byService: ServiceRow[];
}

/** Numbers for the printed report. An activity counts as monitored once any observation exists on it. */
export function summarize(rows: ReportActivity[]): ReportSummary {
  const monitored = rows.filter((r) => r.observations.length > 0).length;
  const count = (st: "open" | "resolved") =>
    rows.reduce((n, r) => n + r.observations.filter((o) => o.status === st).length, 0);

  const bySvc = new Map<string, ServiceRow>();
  for (const r of rows) {
    const name = r.services?.name ?? "No service";
    const s = bySvc.get(name) ?? { name, total: 0, monitored: 0, notMonitored: 0, open: 0 };
    s.total += 1;
    if (r.observations.length > 0) s.monitored += 1;
    else s.notMonitored += 1;
    s.open += r.observations.filter((o) => o.status === "open").length;
    bySvc.set(name, s);
  }

  const unmonitoredCritical = rows
    .filter((r) => r.priority === "critical" && r.observations.length === 0)
    .sort((a, b) => (a.activity_date + a.start_time).localeCompare(b.activity_date + b.start_time));

  return {
    total: rows.length,
    monitored,
    notMonitored: rows.length - monitored,
    percent: rows.length ? Math.round((monitored / rows.length) * 100) : 0,
    open: count("open"),
    resolved: count("resolved"),
    criticalWithOpen: rows.filter(
      (r) => r.priority === "critical" && r.observations.some((o) => o.status === "open"),
    ).length,
    unmonitoredCritical,
    byService: Array.from(bySvc.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** "2026-11-14" -> "14 Nov 2026" */
export function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
