"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { ErrorNote, Spinner } from "@/components/ui";
import { useLoad } from "@/lib/hooks";
import { fmtDateShort, summarize, type ReportActivity } from "@/lib/report";
import { supabase } from "@/lib/supabase";
import { fmtTime, todayISO } from "@/lib/time";
import type { Priority, RemarkKind, Role } from "@/lib/types";

const ACT_SELECT = "id, title, activity_date, start_time, end_time, priority, services(name), observations(id, status)";
const OBS_SELECT =
  "id, remarks, created_at, submitter:profiles!submitted_by(full_name), activities!inner(title, activity_date, start_time, end_time, priority, services(name)), observation_remarks(body, kind, created_at, author_role)";

interface OpenObs {
  id: string;
  remarks: string | null;
  created_at: string;
  submitter: { full_name: string } | null;
  activities: {
    title: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    priority: Priority;
    services: { name: string } | null;
  };
  observation_remarks: { body: string; kind: RemarkKind; created_at: string; author_role: Role }[];
}

const ROLE_SHORT: Record<Role, string> = { admin: "Admin", me: "Maintenance Engineer", se: "Shift Engineer", gm: "GM" };

// Fixed colours on purpose: the sheet must look the same on screen, in dark mode and on paper.
const TH = "border border-[#d4d4d8] bg-[#f4f4f5] px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#3f3f46]";
const TD = "border border-[#d4d4d8] px-2 py-1.5 align-top text-[11px] text-[#18181b]";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 border-b border-[#18181b] pb-1 text-sm font-bold uppercase tracking-wide text-[#18181b]">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="print-keep rounded border border-[#d4d4d8] px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#71717a]">{label}</div>
      <div className="text-2xl font-bold text-[#18181b]">{value}</div>
      {note && <div className="text-[10px] text-[#71717a]">{note}</div>}
    </div>
  );
}

export default function ReportPage() {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  // The Overview passes its dates in the address: /gm/report/?from=...&to=...
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ok = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const from = ok(q.get("from")) ?? todayISO();
    const to = ok(q.get("to")) ?? from;
    setRange(from <= to ? { from, to } : { from: to, to: from });
  }, []);

  if (!range) return <Spinner />;
  return <Report from={range.from} to={range.to} />;
}

function Report({ from, to }: { from: string; to: string }) {
  const { data, loading, error } = useLoad(async () => {
    const sb = supabase();
    const [acts, obs] = await Promise.all([
      sb
        .from("activities")
        .select(ACT_SELECT)
        .gte("activity_date", from)
        .lte("activity_date", to)
        .order("activity_date")
        .order("start_time")
        .limit(3000),
      sb
        .from("observations")
        .select(OBS_SELECT)
        .eq("status", "open")
        .gte("activities.activity_date", from)
        .lte("activities.activity_date", to)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (acts.error) throw new Error(acts.error.message);
    if (obs.error) throw new Error(obs.error.message);
    return {
      rows: (acts.data ?? []) as unknown as ReportActivity[],
      open: (obs.data ?? []) as unknown as OpenObs[],
    };
  }, [from, to]);

  const s = data ? summarize(data.rows) : null;
  const period = from === to ? fmtDateShort(from) : `${fmtDateShort(from)} to ${fmtDateShort(to)}`;

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/gm/" className="btn btn-secondary">
          Back to Overview
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={!s}>
          Print or save as PDF
        </button>
      </div>
      <p className="no-print mb-3 text-xs text-zinc-500">
        In the print window choose Save as PDF as the printer to get a file you can send. To change the dates, go back to the Overview.
      </p>

      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner label="Preparing report" />
      ) : s && data ? (
        <article className="report-sheet mx-auto max-w-[794px] bg-[#ffffff] p-6 text-[#18181b] shadow-sm ring-1 ring-[#e4e4e7] sm:p-10">
          {/* A div, not a header: the print CSS hides every header tag (the app bar). */}
          <div className="mb-6 border-b-2 border-[#18181b] pb-3">
            <h1 className="text-2xl font-bold text-[#18181b]">Maintenance Report</h1>
            <p className="text-sm text-[#3f3f46]">NSCBI Airport · Terminal Building</p>
            <p className="mt-1 text-sm font-semibold text-[#18181b]">Period: {period}</p>
          </div>

          <Section title="Summary">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Kpi label="Planned activities" value={String(s.total)} />
              <Kpi label="Monitored" value={`${s.percent}%`} note={`${s.monitored} of ${s.total}`} />
              <Kpi label="Not yet monitored" value={String(s.notMonitored)} />
              <Kpi label="Open observations" value={String(s.open)} />
              <Kpi label="Resolved observations" value={String(s.resolved)} />
              <Kpi label="Critical with open issues" value={String(s.criticalWithOpen)} />
            </div>
          </Section>

          <Section title="By service">
            {s.byService.length === 0 ? (
              <p className="text-sm text-[#52525b]">No activities in this period.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Service</th>
                    <th className={`${TH} text-right`}>Planned</th>
                    <th className={`${TH} text-right`}>Monitored</th>
                    <th className={`${TH} text-right`}>Not monitored</th>
                    <th className={`${TH} text-right`}>Open observations</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byService.map((r) => (
                    <tr key={r.name} className="print-keep">
                      <td className={`${TD} font-semibold`}>{r.name}</td>
                      <td className={`${TD} text-right`}>{r.total}</td>
                      <td className={`${TD} text-right`}>{r.monitored}</td>
                      <td className={`${TD} text-right`}>{r.notMonitored}</td>
                      <td className={`${TD} text-right ${r.open ? "font-bold" : ""}`}>{r.open}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Critical activities not yet monitored">
            {s.unmonitoredCritical.length === 0 ? (
              <p className="text-sm text-[#52525b]">None.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Date</th>
                    <th className={TH}>Time</th>
                    <th className={TH}>Service</th>
                    <th className={TH}>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {s.unmonitoredCritical.map((a) => (
                    <tr key={a.id} className="print-keep">
                      <td className={TD}>{fmtDateShort(a.activity_date)}</td>
                      <td className={TD}>
                        {fmtTime(a.start_time)} - {fmtTime(a.end_time)}
                      </td>
                      <td className={TD}>{a.services?.name}</td>
                      <td className={TD}>{a.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Open observations">
            {data.open.length === 0 ? (
              <p className="text-sm text-[#52525b]">No open observations in this period.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Activity</th>
                    <th className={TH}>Observed by</th>
                    <th className={TH}>Observation</th>
                    <th className={TH}>Latest remark</th>
                  </tr>
                </thead>
                <tbody>
                  {data.open.map((o) => {
                    const last = [...o.observation_remarks]
                      .filter((r) => r.kind === "remark")
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                    return (
                      <tr key={o.id} className="print-keep">
                        <td className={TD}>
                          <div className="font-semibold">{o.activities.services?.name}</div>
                          <div>{o.activities.title}</div>
                          <div className="text-[10px] text-[#71717a]">
                            {fmtDateShort(o.activities.activity_date)} · {fmtTime(o.activities.start_time)} - {fmtTime(o.activities.end_time)}
                          </div>
                        </td>
                        <td className={TD}>
                          {o.submitter?.full_name}
                          <div className="text-[10px] text-[#71717a]">{new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                        </td>
                        <td className={TD}>{o.remarks || "No note written."}</td>
                        <td className={TD}>
                          {last ? (
                            <>
                              <div className="text-[10px] text-[#71717a]">{ROLE_SHORT[last.author_role]}</div>
                              {last.body}
                            </>
                          ) : (
                            "None yet."
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>

          <footer className="mt-8 border-t border-[#d4d4d8] pt-2 text-[10px] text-[#71717a]">
            Generated from Maintenance Tracker on {new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}.
          </footer>
        </article>
      ) : null}
    </div>
  );
}
