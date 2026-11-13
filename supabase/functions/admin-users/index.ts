// Supabase Edge Function (Deno): admin-only user management.
// The service-role key never leaves the server; callers must be an active admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ROLES = ["admin", "me", "se", "gm"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Who is calling?
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await caller.auth.getUser();
  if (!u?.user) return json({ error: "Not signed in" }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role, active").eq("id", u.user.id).maybeSingle();
  if (!me || !me.active || me.role !== "admin") return json({ error: "Admins only" }, 403);

  // 2. Act
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "create") {
    const loginId = (body.login_id ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,40}$/.test(loginId)) return json({ error: "Login ID: 2-40 letters, numbers, . _ -" }, 400);
    if (!ROLES.includes(body.role)) return json({ error: "Invalid role" }, 400);
    if ((body.password ?? "").length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    const { data, error } = await admin.auth.admin.createUser({
      email: `${loginId}@mts.local`,
      password: body.password,
      email_confirm: true,
      app_metadata: { role: body.role },
      user_metadata: { full_name: body.full_name, employee_id: body.employee_id || null, phone: body.phone || null },
    });
    if (error) return json({ error: error.message }, 400);
    // The signup trigger runs before app_metadata is stored, so set the role explicitly.
    const { error: roleErr } = await admin.from("profiles").update({ role: body.role }).eq("id", data.user!.id);
    if (roleErr) return json({ error: roleErr.message }, 500);
    return json({ ok: true, id: data.user?.id });
  }

  if (body.action === "reset_password") {
    if ((body.password ?? "").length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "set_role") {
    if (!ROLES.includes(body.role)) return json({ error: "Invalid role" }, 400);
    if (body.user_id === u.user.id && body.role !== "admin") return json({ error: "You cannot remove your own admin role" }, 400);
    const { error } = await admin.from("profiles").update({ role: body.role }).eq("id", body.user_id);
    if (error) return json({ error: error.message }, 400);
    await admin.auth.admin.updateUserById(body.user_id, { app_metadata: { role: body.role } });
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
