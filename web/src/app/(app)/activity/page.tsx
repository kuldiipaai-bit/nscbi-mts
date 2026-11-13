"use client";

import Link from "next/link";
import { ObservationDetail } from "@/components/ObservationDetail";
import { ObservationForm } from "@/components/ObservationForm";
import { Empty, ErrorNote, PageTitle, PriorityBadge, Spinner, StateChip } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLoad, useQueryParam } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { activityState, crossesMidnight, fmtDateLong, fmtTime } from "@/lib/time";
import type { Activity } from "@/lib/types";

export default function ActivityPage() {
  const id = useQueryParam("id");
  if (!id) return <Spinner />;
  return <Inner id={id} />;
}

function Inner({ id }: { id: string }) {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useLoad<(Activity & { observations: { id: string }[] }) | null>(async () => {
    const { data, error } = await supabase()
      .from("activities")
      .select("*, services(name, owner_me_id), observations(id, created_at)")
      .eq("id", id)
      .order("created_at", { referencedTable: "observations", ascending: false })
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as (Activity & { observations: { id: string }[] }) | null;
  }, [id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  if (!data || !profile) return <ErrorNote message="Activity not found." />;

  const canEdit = profile.role === "admin" || (profile.role === "me" && data.services?.owner_me_id === profile.id);
  const canObserve = profile.role === "se" || profile.role === "admin";

  return (
    <>
      <PageTitle
        title="Activity"
        action={
          canEdit && (
            <Link href={`/me/new/?id=${data.id}`} className="btn btn-secondary">
              Edit
            </Link>
          )
        }
      />
      <div className="card mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold">
            {fmtTime(data.start_time)} – {fmtTime(data.end_time)}
            {crossesMidnight(data.start_time, data.end_time) ? " (+1d)" : ""}
          </span>
          <StateChip state={activityState(data)} />
          <PriorityBadge priority={data.priority} />
        </div>
        <h2 className="text-lg font-bold">{data.title}</h2>
        <p className="text-sm text-slate-600">
          {data.services?.name}
          {data.location ? ` · ${data.location}` : ""}
        </p>
        <p className="text-xs text-slate-500">
          {fmtDateLong(data.activity_date)}
          {data.agency ? ` · Agency: ${data.agency}` : ""}
        </p>
        {data.description && <p className="whitespace-pre-wrap text-sm">{data.description}</p>}
        {data.checklist.length > 0 && (
          <div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
            <ul className="list-disc pl-5 text-sm">
              {data.checklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {canObserve && (
        <div className="mb-4">
          <ObservationForm activity={data} onSaved={reload} />
        </div>
      )}

      <h2 className="mb-2 text-base font-bold">Observations ({data.observations.length})</h2>
      {data.observations.length === 0 ? (
        <Empty>No one has recorded an observation for this activity yet.</Empty>
      ) : (
        <div className="space-y-3">
          {data.observations.map((o) => (
            <ObservationDetail key={o.id} id={o.id} showActivityLink={false} />
          ))}
        </div>
      )}
    </>
  );
}
