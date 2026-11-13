"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty, ErrorNote, PageTitle, PriorityBadge, Spinner } from "@/components/ui";
import { useLoad } from "@/lib/hooks";
import { downloadText } from "@/lib/excel";
import { supabase } from "@/lib/supabase";
import { addDays, fmtTime, todayISO } from "@/lib/time";
import type { Activity } from "@/lib/types";

const SELECT =
  "id, title, activity_date, start_time, end_time, priority, services(name), observations(id, status, submitter:profiles!submitted_by(full_name))";

type Row = Pick<Activity, "id" | "title" | "activity_date" | "start_time" | "end_time" | "priority"> & {
  services: { name: string } | null;
  observations: { id: string; status: "open" | "resolved"; submitter: { full_name: string } | null }[];
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-zinc-900";
  return (
    <div className="card !p-4">
      <p className="label !mb-1">{label}</p>
      <p className={`text-3xl font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

export default function GmDashboard() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const { data, loading, error } = useLoad<Row[]>(async () => {
    const { data, error } = await supabase()
      .from("activities")
      .select(SELECT)
      .gte("activity_date", from)
      .lte("activity_date", to)
      .order("activity_date")
      .order("start_time")
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Row[];
  }, [from, to]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    const monitored = rows.filter((r) => r.observations.length > 0).length;
    const open = rows.reduce((n, r) => n + r.observations.filter((o) => o.status === "open").length, 0);
    const critOpen = rows.filter((r) => r.priority === "critical" && r.observations.some((o) => o.status === "open")).length;
    const unmonitoredCrit = rows.filter((r) => r.priority === "critical" && r.observations.length === 0);
    const bySvc = new Map<string, { total: number; monitored: number; open: number }>();
    rows.forEach((r) => {
      const k = r.services?.name ?? "—";
      const s = bySvc.get(k) ?? { total: 0, monitored: 0, open: 0 };
      s.total++;
      if (r.observations.length) s.monitored++;
      s.open += r.observations.filter((o) => o.status === "open").length;
      bySvc.set(k, s);
    });
    return { rows, monitored, open, critOpen, unmonitoredCrit, bySvc: Array.from(bySvc.entries()).sort() };
  }, [data]);

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["date", "start", "end", "service", "activity", "priority", "monitored_by", "open_observations", "resolved_observations"];
    const lines = stats.rows.map((r) =>
      [
        r.activity_date,
        fmtTime(r.start_time),
        fmtTime(r.end_time),
        r.services?.name ?? "",
        r.title,
        r.priority,
        Array.from(new Set(r.observations.map((o) => o.submitter?.full_name ?? ""))).join("; "),
        r.observations.filter((o) => o.status === "open").length,
        r.observations.filter((o) => o.status === "resolved").length,
      ]
        .map(esc)
        .join(","),
    );
    downloadText(`maintenance-report-${from}_to_${to}.csv`, [head.join(","), ...lines].join("\r\n"));
  }

  const pct = stats.rows.length ? Math.round((stats.monitored / stats.rows.length) * 100) : 0;

  return (
    <>
      <PageTitle
        title="Overview"
        action={
          <button className="btn btn-secondary" onClick={exportCsv} disabled={stats.rows.length === 0}>
            Export CSV
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" className="input !w-auto" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <span className="text-zinc-400">to</span>
        <input type="date" className="input !w-auto" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
        <button className="btn btn-secondary !min-h-[38px]" onClick={() => (setFrom(todayISO()), setTo(todayISO()))}>
          Today
        </button>
        <button className="btn btn-secondary !min-h-[38px]" onClick={() => (setFrom(addDays(todayISO(), -6)), setTo(todayISO()))}>
          Last 7 days
        </button>
      </div>

      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Activities" value={stats.rows.length} />
            <Kpi label="Monitored" value={`${pct}%`} />
            <Kpi label="Open observations" value={stats.open} tone={stats.open ? "warn" : undefined} />
            <Kpi label="Critical with open issues" value={stats.critOpen} tone={stats.critOpen ? "bad" : undefined} />
          </div>

          {stats.unmonitoredCrit.length > 0 && (
            <div className="card mb-5 border-red-200">
              <p className="mb-2 text-sm font-semibold text-red-700">Critical activities not yet monitored</p>
              <ul className="space-y-1 text-sm">
                {stats.unmonitoredCrit.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <Link href={`/activity/?id=${r.id}`} className="hover:underline">
                      {r.activity_date} {fmtTime(r.start_time)} · {r.services?.name} · {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">By service</h2>
          {stats.bySvc.length === 0 ? (
            <Empty>No activities in this range.</Empty>
          ) : (
            <div className="card mb-5 overflow-x-auto !p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-3 py-3 text-right font-medium">Planned</th>
                    <th className="px-3 py-3 text-right font-medium">Monitored</th>
                    <th className="px-4 py-3 text-right font-medium">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bySvc.map(([name, s]) => (
                    <tr key={name} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.total}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.monitored}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${s.open ? "font-semibold text-amber-600" : "text-zinc-400"}`}>{s.open}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">All activities</h2>
            <Link href="/observations/" className="text-sm font-medium text-zinc-900 underline">
              Open observations
            </Link>
          </div>
          <ul className="space-y-2">
            {stats.rows.slice(0, 200).map((r) => {
              const open = r.observations.filter((o) => o.status === "open").length;
              return (
                <li key={r.id}>
                  <Link href={`/activity/?id=${r.id}`} className="card flex flex-wrap items-center justify-between gap-2 !p-3 hover:border-zinc-400">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-zinc-500">
                        {r.activity_date} · {fmtTime(r.start_time)}–{fmtTime(r.end_time)} · {r.services?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <PriorityBadge priority={r.priority} />
                      <span className={r.observations.length ? "text-emerald-600" : "text-zinc-400"}>
                        {r.observations.length ? "Monitored" : "Pending"}
                      </span>
                      {open > 0 && <span className="font-semibold text-amber-600">{open} open</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
