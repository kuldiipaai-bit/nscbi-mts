"use client";

import { FormEvent, useState } from "react";
import { Empty, ErrorNote, Field, PageTitle, Spinner } from "@/components/ui";
import { useLoad } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { ROLE_LABEL, type Profile, type Role } from "@/lib/types";

const ROLES: Role[] = ["se", "me", "gm", "admin"];

async function callAdminFn(body: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase().functions.invoke("admin-users", { body });
  if (error) {
    // Surface the function's own error message when available
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) return ((await ctx.json()) as { error?: string }).error ?? error.message;
    } catch {
      /* fall through */
    }
    return error.message;
  }
  return (data as { error?: string })?.error ?? null;
}

export default function AdminUsers() {
  const { data, loading, error, reload } = useLoad<Profile[]>(async () => {
    const { data, error } = await supabase().from("profiles").select("*").order("role").order("full_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Profile[];
  }, []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ login_id: "", full_name: "", role: "se" as Role, employee_id: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const err = await callAdminFn({ action: "create", ...form });
    setBusy(false);
    if (err) return setMsg(err);
    setForm({ login_id: "", full_name: "", role: "se", employee_id: "", phone: "", password: "" });
    setOpen(false);
    reload();
  }

  async function resetPw(p: Profile) {
    const pw = prompt(`New password for ${p.full_name} (min 8 characters):`);
    if (!pw) return;
    const err = await callAdminFn({ action: "reset_password", user_id: p.id, password: pw });
    alert(err ?? "Password updated.");
  }

  async function toggleActive(p: Profile) {
    const { error } = await supabase().from("profiles").update({ active: !p.active }).eq("id", p.id);
    if (error) return alert(error.message);
    reload();
  }

  async function changeRole(p: Profile, role: Role) {
    const err = await callAdminFn({ action: "set_role", user_id: p.id, role });
    if (err) return alert(err);
    reload();
  }

  return (
    <>
      <PageTitle
        title="Users"
        action={
          <button className="btn btn-primary" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Add user"}
          </button>
        }
      />
      {open && (
        <form onSubmit={create} className="card mb-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Login ID" hint="Letters/numbers, e.g. employee code">
              <input className="input" value={form.login_id} onChange={(e) => setForm({ ...form, login_id: e.target.value })} required />
            </Field>
            <Field label="Full name">
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </Field>
            <Field label="Role">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employee ID">
              <input className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Temporary password" hint="Min 8 characters">
              <input className="input" type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </Field>
          </div>
          <ErrorNote message={msg} />
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Creating..." : "Create user"}
          </button>
        </form>
      )}
      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <Empty>No users yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id} className={`card flex flex-wrap items-center justify-between gap-3 !p-3 ${p.active ? "" : "opacity-50"}`}>
              <div>
                <p className="text-sm font-medium">{p.full_name}</p>
                <p className="text-xs text-zinc-500">
                  {p.employee_id ?? "—"} {p.phone ? `· ${p.phone}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input !min-h-[38px] !w-auto !py-1 text-sm" value={p.role} onChange={(e) => changeRole(p, e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary !min-h-[38px]" onClick={() => resetPw(p)}>
                  Reset password
                </button>
                <button className="btn btn-secondary !min-h-[38px]" onClick={() => toggleActive(p)}>
                  {p.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
