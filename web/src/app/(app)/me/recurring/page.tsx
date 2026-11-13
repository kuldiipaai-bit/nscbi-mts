"use client";

import { FormEvent, useState } from "react";
import { ActivityFields, ActivityDraft, checklistFromText, emptyDraft } from "@/components/ActivityFields";
import { Empty, ErrorNote, Field, PageTitle, PriorityBadge, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/hooks";
import { useMyServices } from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { addDays, fmtTime, todayISO } from "@/lib/time";
import type { Priority, Recurrence } from "@/lib/types";

interface ScheduleRow {
  id: string;
  title: string;
  recurrence: Recurrence;
  weekdays: number[];
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  priority: Priority;
  active: boolean;
  services: { name: string } | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describe(s: ScheduleRow): string {
  switch (s.recurrence) {
    case "daily":
      return "Every day";
    case "weekly":
      return "Every " + s.weekdays.map((d) => DAYS[d]).join(", ");
    case "monthly":
      return `Monthly on day ${s.day_of_month}`;
    default:
      return `Quarterly on day ${s.day_of_month}`;
  }
}

export default function RecurringPage() {
  const { profile } = useAuth();
  const { data: services } = useMyServices();
  const list = useLoad<ScheduleRow[]>(async () => {
    const { data, error } = await supabase()
      .from("schedules")
      .select("*, services(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ScheduleRow[];
  }, []);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft());
  const [recurrence, setRecurrence] = useState<Recurrence>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [dom, setDom] = useState(1);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (recurrence === "weekly" && weekdays.length === 0) return setError("Pick at least one weekday.");
    setBusy(true);
    setError(null);
    const { data, error } = await supabase()
      .from("schedules")
      .insert({
        service_id: draft.service_id,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        location: draft.location.trim() || null,
        start_time: draft.start_time,
        end_time: draft.end_time,
        priority: draft.priority,
        agency: draft.agency.trim() || null,
        checklist: checklistFromText(draft.checklist),
        recurrence,
        weekdays: recurrence === "weekly" ? weekdays : [],
        day_of_month: recurrence === "monthly" || recurrence === "quarterly" ? dom : null,
        start_date: startDate,
        end_date: endDate || null,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return setError(error?.message ?? "Could not save schedule");
    }
    const gen = await supabase().rpc("generate_schedule_activities", { p_schedule: data.id, p_until: addDays(todayISO(), 90) });
    setBusy(false);
    if (gen.error) return setError(gen.error.message);
    setOpen(false);
    setDraft(emptyDraft());
    list.reload();
  }

  async function stop(id: string) {
    if (!confirm("Stop this recurring schedule? Future unobserved activities will be removed; history is kept.")) return;
    const { error } = await supabase().rpc("stop_schedule", { p_schedule: id });
    if (error) return alert(error.message);
    list.reload();
  }

  return (
    <>
      <PageTitle
        title="Recurring schedules"
        action={
          <button className="btn btn-primary" onClick={() => setOpen(!open)}>
            {open ? "Close" : "New recurring"}
          </button>
        }
      />

      {open && (
        <form onSubmit={onSubmit} className="card mb-4 space-y-4">
          <ActivityFields value={draft} onChange={setDraft} services={services ?? []} />
          <Field label="Repeat">
            <select className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly (every 3 months)</option>
            </select>
          </Field>
          {recurrence === "weekly" && (
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <label key={d} className={`btn !min-h-[40px] cursor-pointer ${weekdays.includes(i) ? "btn-primary" : "btn-secondary"}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={weekdays.includes(i)}
                    onChange={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])}
                  />
                  {d}
                </label>
              ))}
            </div>
          )}
          {(recurrence === "monthly" || recurrence === "quarterly") && (
            <Field label="Day of month" hint="Short months use their last day">
              <input type="number" min={1} max={31} className="input" value={dom} onChange={(e) => setDom(Number(e.target.value))} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts on">
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <Field label="Ends on (optional)">
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <ErrorNote message={error} />
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Saving..." : "Create schedule"}
          </button>
        </form>
      )}

      <ErrorNote message={list.error} />
      {list.loading && !list.data ? (
        <Spinner />
      ) : !list.data || list.data.length === 0 ? (
        <Empty>No recurring schedules yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.data.map((s) => (
            <li key={s.id} className={`card ${s.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-slate-600">{s.services?.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {describe(s)} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)} · from {s.start_date}
                    {s.end_date ? ` to ${s.end_date}` : ""}
                  </p>
                </div>
                <PriorityBadge priority={s.priority} />
              </div>
              {s.active ? (
                <button className="btn btn-secondary mt-3 !min-h-[38px]" onClick={() => stop(s.id)}>
                  Stop schedule
                </button>
              ) : (
                <p className="mt-2 text-xs font-medium text-slate-500">Stopped</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
