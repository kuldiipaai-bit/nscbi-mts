"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, ErrorNote, PageTitle, Spinner, StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { fmtDateTime, fmtTime } from "@/lib/time";
import type { ObsStatus } from "@/lib/types";

interface Row {
  id: string;
  status: ObsStatus;
  remarks: string | null;
  created_at: string;
  submitter: { full_name: string } | null;
  activities: {
    title: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    services: { name: string; owner_me_id: string | null } | null;
  } | null;
  observation_remarks: { id: string }[];
}

/** Observation feed: everyone can see it; Maintenance Engineers see only their own services. */
export default function ObservationsFeed() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  const { data, loading, error } = useLoad<Row[]>(async () => {
    let q = supabase()
      .from("observations")
      .select(
        "id, status, remarks, created_at, submitter:profiles!submitted_by(full_name), activities(title, activity_date, start_time, end_time, services(name, owner_me_id)), observation_remarks(id)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Row[];
  }, [filter]);

  const rows = (data ?? []).filter(
    (r) => profile?.role !== "me" || r.activities?.services?.owner_me_id === profile.id,
  );

  return (
    <>
      <PageTitle title="Observations" />
      <div className="mb-3 flex gap-2">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn !min-h-[38px] capitalize ${filter === f ? "btn-primary" : "btn-secondary"}`}
          >
            {f}
          </button>
        ))}
      </div>
      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty>No observations found.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/observation/?id=${r.id}`} className="card block hover:border-brand-500">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {r.activities?.services?.name} · {r.activities?.title}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {r.activities?.activity_date} {r.activities && `${fmtTime(r.activities.start_time)}–${fmtTime(r.activities.end_time)}`} ·{" "}
                  {r.submitter?.full_name} · {fmtDateTime(r.created_at)}
                </p>
                {r.remarks && <p className="mt-1 line-clamp-2 text-sm text-slate-700">{r.remarks}</p>}
                {r.observation_remarks.length > 0 && (
                  <p className="mt-1 text-xs font-medium text-brand-600">{r.observation_remarks.length} remark(s)</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
