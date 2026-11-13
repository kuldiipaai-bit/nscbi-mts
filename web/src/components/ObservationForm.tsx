"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { compressImage } from "@/lib/image";
import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import type { Activity } from "@/lib/types";
import { ErrorNote } from "./ui";

const MAX_PHOTOS = 4;

/** Shift Engineer records what they saw: tick, checklist, remarks, photos. */
export function ObservationForm({ activity, onSaved }: { activity: Activity; onSaved: () => void }) {
  const { profile } = useAuth();
  const [monitored, setMonitored] = useState(true);
  const [done, setDone] = useState<boolean[]>(activity.checklist.map(() => false));
  const [remarks, setRemarks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_PHOTOS);
    setFiles(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const sb = supabase();
      const results = activity.checklist.map((item, i) => ({ item, done: done[i] }));
      const { data: obs, error: insErr } = await sb
        .from("observations")
        .insert({
          activity_id: activity.id,
          submitted_by: profile.id,
          monitored,
          checklist_results: results,
          remarks: remarks.trim() || null,
        })
        .select("id")
        .single();
      if (insErr || !obs) throw new Error(insErr?.message ?? "Could not save observation");

      for (const f of files) {
        const blob = await compressImage(f);
        const path = `${obs.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
        const { error: rowErr } = await sb.from("observation_photos").insert({ observation_id: obs.id, storage_path: path });
        if (rowErr) throw new Error(rowErr.message);
      }
      setRemarks("");
      setFiles([]);
      setDone(activity.checklist.map(() => false));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-base font-bold">Record my observation</h2>

      <label className="flex min-h-[44px] items-center gap-3 rounded-lg bg-slate-50 px-3 text-base font-medium">
        <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={monitored} onChange={(e) => setMonitored(e.target.checked)} />
        I visited and monitored this maintenance activity
      </label>

      {activity.checklist.length > 0 && (
        <div>
          <p className="label">Checklist</p>
          <ul className="space-y-2">
            {activity.checklist.map((item, i) => (
              <li key={i}>
                <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-slate-200 px-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-600"
                    checked={done[i]}
                    onChange={(e) => setDone(done.map((d, j) => (j === i ? e.target.checked : d)))}
                  />
                  <span className="text-sm">{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label className="label">Remarks / observation</label>
        <textarea
          className="input min-h-[96px]"
          placeholder="What did you observe? Any problem, delay or safety concern?"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Photos (max {MAX_PHOTOS})</label>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          disabled={files.length >= MAX_PHOTOS}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:font-semibold file:text-brand-700"
        />
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-600 text-xs font-bold text-white"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ErrorNote message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Saving..." : "Submit observation"}
      </button>
    </form>
  );
}
