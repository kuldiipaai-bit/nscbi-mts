"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/hooks";
import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import { fmtDateTime, fmtTime } from "@/lib/time";
import { ROLE_LABEL, type Observation, type RemarkRow, type Role } from "@/lib/types";
import { ErrorNote, Spinner, StatusBadge } from "./ui";

interface Full extends Observation {
  submitter: { full_name: string } | null;
  resolver: { full_name: string } | null;
  activities: {
    id: string;
    title: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    services: { name: string; owner_me_id: string | null } | null;
  } | null;
  observation_photos: { id: string; storage_path: string }[];
  observation_remarks: RemarkRow[];
}

const SELECT = `*,
  submitter:profiles!submitted_by(full_name),
  resolver:profiles!resolved_by(full_name),
  activities(id, title, activity_date, start_time, end_time, services(name, owner_me_id)),
  observation_photos(id, storage_path),
  observation_remarks(*, author:profiles!author_id(full_name))`;

export function ObservationDetail({ id, showActivityLink = true }: { id: string; showActivityLink?: boolean }) {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useLoad<Full | null>(async () => {
    const { data, error } = await supabase().from("observations").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as Full | null;
  }, [id]);

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [remark, setRemark] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Signed URLs for private photos
  useEffect(() => {
    const paths = data?.observation_photos.map((p) => p.storage_path) ?? [];
    if (paths.length === 0) return;
    supabase()
      .storage.from(PHOTO_BUCKET)
      .createSignedUrls(paths, 3600)
      .then(({ data: urls }) => {
        const m: Record<string, string> = {};
        urls?.forEach((u) => {
          if (u.path && u.signedUrl) m[u.path] = u.signedUrl;
        });
        setPhotoUrls(m);
      });
  }, [data?.observation_photos]);

  // Opening an observation clears its notifications
  useEffect(() => {
    if (!profile) return;
    supabase().from("notifications").update({ read: true }).eq("observation_id", id).eq("read", false).then(() => {});
  }, [id, profile]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  if (!data || !profile) return <ErrorNote message="Observation not found." />;

  const role: Role = profile.role;
  const isOwner = data.activities?.services?.owner_me_id === profile.id;
  const canRemark = role === "gm" || role === "admin" || (role === "me" && isOwner);
  const canResolve = data.status === "open" && (role !== "me" || isOwner);
  const canReopen = data.status === "resolved" && (role === "gm" || role === "admin" || (role === "me" && isOwner));
  const thread = [...data.observation_remarks].sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function addRemark(e: FormEvent) {
    e.preventDefault();
    if (!remark.trim() || !profile) return;
    setBusy(true);
    setActionError(null);
    const { error } = await supabase().from("observation_remarks").insert({
      observation_id: id,
      author_id: profile.id,
      author_role: profile.role,
      body: remark.trim(),
      kind: "remark",
    });
    setBusy(false);
    if (error) return setActionError(error.message);
    setRemark("");
    reload();
  }

  async function setStatus(status: "resolved" | "open") {
    if (!note.trim()) return setActionError("Please write a note first.");
    setBusy(true);
    setActionError(null);
    const { error } = await supabase().rpc("set_observation_status", { p_obs: id, p_status: status, p_note: note.trim() });
    setBusy(false);
    if (error) return setActionError(error.message);
    setNote("");
    reload();
  }

  const act = data.activities;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {act && (
            <p className="text-sm font-semibold text-slate-900">
              {act.services?.name} · {act.title}
            </p>
          )}
          {act && (
            <p className="text-xs text-slate-500">
              {act.activity_date} · {fmtTime(act.start_time)}–{fmtTime(act.end_time)}
            </p>
          )}
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">
          {data.submitter?.full_name ?? "Shift Engineer"} · {fmtDateTime(data.created_at)} ·{" "}
          {data.monitored ? "Monitored" : "Not monitored"}
        </p>
        {data.checklist_results.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {data.checklist_results.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`w-14 shrink-0 text-xs font-semibold uppercase ${c.done ? "text-emerald-600" : "text-slate-400"}`}>
                  {c.done ? "Done" : "Not done"}
                </span>
                <span className={c.done ? "" : "text-slate-500"}>{c.item}</span>
              </li>
            ))}
          </ul>
        )}
        {data.remarks && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{data.remarks}</p>}
        {data.observation_photos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.observation_photos.map((p) => {
              const url = photoUrls[p.storage_path];
              return (
                <li key={p.id}>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Observation photo" className="h-24 w-24 rounded-lg object-cover" />
                    </a>
                  ) : (
                    <div className="h-24 w-24 animate-pulse rounded-lg bg-slate-200" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {thread.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks / actions</p>
          {thread.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-3 text-sm ${
                r.kind === "resolve"
                  ? "border-emerald-200 bg-emerald-50"
                  : r.kind === "reopen"
                    ? "border-amber-200 bg-amber-50"
                    : "border-brand-100 bg-brand-50"
              }`}
            >
              <p className="mb-0.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{r.author?.full_name}</span> ({ROLE_LABEL[r.author_role]}) ·{" "}
                {fmtDateTime(r.created_at)}
                {r.kind === "resolve" && " · marked resolved"}
                {r.kind === "reopen" && " · reopened"}
              </p>
              <p className="whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {canRemark && data.status === "open" && (
        <form onSubmit={addRemark} className="space-y-2">
          <label className="label">Add remark / further action (visible to all Shift Engineers)</label>
          <textarea className="input min-h-[80px]" value={remark} onChange={(e) => setRemark(e.target.value)} required />
          <button className="btn btn-primary" disabled={busy}>
            Post remark
          </button>
        </form>
      )}

      {(canResolve || canReopen) && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <label className="label">{canResolve ? "Closing note" : "Reason for reopening"}</label>
          <textarea className="input min-h-[64px]" value={note} onChange={(e) => setNote(e.target.value)} />
          {canResolve ? (
            <button className="btn btn-success" disabled={busy} onClick={() => setStatus("resolved")}>
              Mark as resolved
            </button>
          ) : (
            <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus("open")}>
              Reopen
            </button>
          )}
        </div>
      )}

      <ErrorNote message={actionError} />
      {showActivityLink && act && (
        <Link className="text-sm font-semibold text-brand-600" href={`/activity/?id=${act.id}`}>
          View activity
        </Link>
      )}
    </div>
  );
}
