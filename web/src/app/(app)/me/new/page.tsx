"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ActivityFields, ActivityDraft, checklistFromText, emptyDraft } from "@/components/ActivityFields";
import { ErrorNote, Field, PageTitle, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useQueryParam } from "@/lib/hooks";
import { useMyServices } from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { todayISO } from "@/lib/time";

export default function NewActivity() {
  const { profile } = useAuth();
  const router = useRouter();
  const editId = useQueryParam("id");
  const { data: services, loading } = useMyServices();
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft());
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    supabase()
      .from("activities")
      .select("*")
      .eq("id", editId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDate(data.activity_date);
        setDraft({
          service_id: data.service_id,
          title: data.title,
          description: data.description ?? "",
          location: data.location ?? "",
          start_time: data.start_time.slice(0, 5),
          end_time: data.end_time.slice(0, 5),
          priority: data.priority,
          agency: data.agency ?? "",
          checklist: (data.checklist as string[]).join("\n"),
        });
      });
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError(null);
    const row = {
      service_id: draft.service_id,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      location: draft.location.trim() || null,
      activity_date: date,
      start_time: draft.start_time,
      end_time: draft.end_time,
      priority: draft.priority,
      agency: draft.agency.trim() || null,
      checklist: checklistFromText(draft.checklist),
    };
    const { error } = editId
      ? await supabase().from("activities").update(row).eq("id", editId)
      : await supabase().from("activities").insert({ ...row, created_by: profile.id });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/me/");
  }

  async function onDelete() {
    if (!editId || !confirm("Delete this activity and any observations on it?")) return;
    const { error } = await supabase().from("activities").delete().eq("id", editId);
    if (error) return setError(error.message);
    router.replace("/me/");
  }

  if (loading) return <Spinner />;
  return (
    <>
      <PageTitle title={editId ? "Edit activity" : "Add activity"} />
      {services && services.length === 0 && (
        <ErrorNote message="No services are assigned to you yet. Ask the Admin to assign services." />
      )}
      <form onSubmit={onSubmit} className="card space-y-4">
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <ActivityFields value={draft} onChange={setDraft} services={services ?? []} />
        <ErrorNote message={error} />
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={busy}>
            {busy ? "Saving..." : editId ? "Save changes" : "Add activity"}
          </button>
          {editId && (
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </form>
    </>
  );
}
