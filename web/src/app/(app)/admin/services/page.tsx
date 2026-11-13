"use client";

import { FormEvent, useState } from "react";
import { Empty, ErrorNote, Field, PageTitle, Spinner } from "@/components/ui";
import { useLoad } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { Profile, Service } from "@/lib/types";

export default function AdminServices() {
  const { data, loading, error, reload } = useLoad<{ services: Service[]; mes: Profile[] }>(async () => {
    const sb = supabase();
    const [s, p] = await Promise.all([
      sb.from("services").select("*").order("name"),
      sb.from("profiles").select("*").eq("role", "me").eq("active", true).order("full_name"),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (p.error) throw new Error(p.error.message);
    return { services: (s.data ?? []) as Service[], mes: (p.data ?? []) as Profile[] };
  }, []);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase()
      .from("services")
      .insert({ name: name.trim(), location: location.trim() || null, owner_me_id: owner || null });
    if (error) return setMsg(error.message);
    setName("");
    setLocation("");
    setOwner("");
    reload();
  }

  async function setOwnerFor(s: Service, ownerId: string) {
    const { error } = await supabase().from("services").update({ owner_me_id: ownerId || null }).eq("id", s.id);
    if (error) return alert(error.message);
    reload();
  }

  async function toggle(s: Service) {
    const { error } = await supabase().from("services").update({ active: !s.active }).eq("id", s.id);
    if (error) return alert(error.message);
    reload();
  }

  return (
    <>
      <PageTitle title="Services" />
      <form onSubmit={add} className="card mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Service name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Maintenance Engineer">
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Unassigned</option>
              {data?.mes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorNote message={msg} />
        <button className="btn btn-primary">Add service</button>
      </form>

      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner />
      ) : !data || data.services.length === 0 ? (
        <Empty>No services yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.services.map((s) => (
            <li key={s.id} className={`card flex flex-wrap items-center justify-between gap-3 !p-3 ${s.active ? "" : "opacity-50"}`}>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.location ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="input !min-h-[38px] !w-auto !py-1 text-sm" value={s.owner_me_id ?? ""} onChange={(e) => setOwnerFor(s, e.target.value)}>
                  <option value="">Unassigned</option>
                  {data.mes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary !min-h-[38px]" onClick={() => toggle(s)}>
                  {s.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
