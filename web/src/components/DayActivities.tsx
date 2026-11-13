"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { Activity } from "@/lib/types";
import { activityState, addDays, crossesMidnight, fmtDateLong, fmtTime, todayISO, visibleOnDay } from "@/lib/time";
import { Empty, ErrorNote, PriorityBadge, Spinner, StateChip } from "./ui";

const SELECT =
  "*, services(name, owner_me_id), observations(id, status, monitored, created_at, submitted_by, submitter:profiles!submitted_by(full_name))";

/**
 * Consolidated activities for one day.
 * - everyone: all services (Shift Engineers, GM, Admin)
 * - ownOnly: Maintenance Engineer view, restricted to services they own, with edit links.
 */
export function DayActivities({ ownOnly = false }: { ownOnly?: boolean }) {
  const { profile } = useAuth();
  const [day, setDay] = useState(todayISO());
  const [service, setService] = useState("all");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data, loading, error } = useLoad<Activity[]>(async () => {
    const { data, error } = await supabase()
      .from("activities")
      .select(SELECT)
      .gte("activity_date", addDays(day, -1))
      .lte("activity_date", day)
      .order("start_time");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Activity[];
  }, [day]);

  const list = useMemo(() => {
    let rows = visibleOnDay(data ?? [], day);
    if (ownOnly && profile) rows = rows.filter((a) => a.services?.owner_me_id === profile.id);
    return rows;
  }, [data, day, ownOnly, profile]);

  const serviceNames = useMemo(
    () => Array.from(new Set(list.map((a) => a.services?.name ?? "").filter(Boolean))).sort(),
    [list],
  );
  const filtered = service === "all" ? list : list.filter((a) => a.services?.name === service);
  const isToday = day === todayISO();

  const running = filtered.filter((a) => isToday && activityState(a, now) === "running").length;
  const checked = filtered.filter((a) => (a.observations?.length ?? 0) > 0).length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button className="btn btn-secondary !px-3" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
          Prev
        </button>
        <input
          type="date"
          className="input text-center font-semibold"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <button className="btn btn-secondary !px-3" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
          Next
        </button>
        {!isToday && (
          <button className="btn btn-secondary" onClick={() => setDay(todayISO())}>
            Today
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{fmtDateLong(day)}</p>
        <p className="text-xs text-slate-500">
          {filtered.length} activities
          {isToday ? ` · ${running} running now` : ""} · {checked} monitored
        </p>
      </div>

      {serviceNames.length > 1 && (
        <select className="input mb-3" value={service} onChange={(e) => setService(e.target.value)}>
          <option value="all">All services</option>
          {serviceNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}

      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Empty>No maintenance activities scheduled for this day.</Empty>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const st = activityState(a, now);
            const obs = a.observations ?? [];
            const open = obs.filter((o) => o.status === "open").length;
            const by = Array.from(new Set(obs.map((o) => o.submitter?.full_name).filter(Boolean)));
            return (
              <li key={a.id}>
                <Link
                  href={`/activity/?id=${a.id}`}
                  className={`card block transition hover:border-brand-500 ${st === "running" ? "border-l-4 border-l-emerald-500" : ""}`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-slate-800">
                      {fmtTime(a.start_time)} – {fmtTime(a.end_time)}
                      {crossesMidnight(a.start_time, a.end_time) ? " (+1d)" : ""}
                    </span>
                    <StateChip state={st} />
                    <PriorityBadge priority={a.priority} />
                    {a.activity_date !== day && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                        Started yesterday
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <p className="text-sm text-slate-600">
                    {a.services?.name}
                    {a.location ? ` · ${a.location}` : ""}
                    {a.agency ? ` · ${a.agency}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {obs.length === 0 ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Not monitored yet</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                        Monitored by {by.join(", ")}
                      </span>
                    )}
                    {open > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{open} open</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
