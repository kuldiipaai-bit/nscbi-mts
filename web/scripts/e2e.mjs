// End-to-end data-flow test against a LOCAL Supabase stack (npx supabase start).
// Uses the same queries as the app screens, logged in as the seeded demo users.
//   node scripts/e2e.mjs        (run from web/, needs .env.local from the local stack)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/127\.0\.0\.1|localhost/.test(URL_)) throw new Error("Refusing to run: not a local Supabase URL");

let passed = 0, failed = 0;
const ok = (cond, name, extra = "") => { cond ? passed++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`); };
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

async function as(login) {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  must(await sb.auth.signInWithPassword({ email: `${login}@mts.local`, password: "Demo@12345" }), `login ${login}`);
  const { data } = await sb.auth.getUser();
  return { sb, id: data.user.id };
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = iso(new Date());
const tag = `E2E-${Date.now()}`;

const ACT_SELECT = "*, services(name, owner_me_id), observations(id, status, monitored, created_at, submitted_by, submitter:profiles!submitted_by(full_name))";
const OBS_SELECT = `*,
  submitter:profiles!submitted_by(full_name),
  resolver:profiles!resolved_by(full_name),
  activities(id, title, activity_date, start_time, end_time, services(name, owner_me_id)),
  observation_photos(id, storage_path),
  observation_remarks(*, author:profiles!author_id(full_name))`;

// 1x1 JPEG
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

const me = await as("me_elec"), meOther = await as("me_hvac"), se1 = await as("se1"), se2 = await as("se2"), gm = await as("gm1"), admin = await as("admin1");

// ---------- ME: schedule
const svcs = must(await me.sb.from("services").select("*").eq("owner_me_id", me.id).eq("active", true), "my services");
ok(svcs.length >= 1, "ME sees only own services", `got ${svcs.length}`);
const svc = svcs[0];

const created = must(await me.sb.from("activities").insert({
  service_id: svc.id, title: `${tag} panel check`, activity_date: today, start_time: "00:00", end_time: "23:59",
  priority: "high", agency: "In-house", location: "Substation", checklist: ["Door safe", "Readings noted"], created_by: me.id,
}).select("*").single(), "ME add activity");
ok(created.title.startsWith(tag), "ME adds an activity (form)");

const bulk = must(await me.sb.from("activities").insert([1, 2, 3].map((i) => ({
  service_id: svc.id, title: `${tag} bulk ${i}`, activity_date: today, start_time: `0${i}:00`, end_time: `0${i}:30`, priority: "low", checklist: [], created_by: me.id,
}))).select("id"), "ME bulk insert");
ok(bulk.length === 3, "ME bulk-inserts imported rows");

const upd = must(await me.sb.from("activities").update({ title: `${tag} panel check v2` }).eq("id", created.id).select("title"), "ME edit");
ok(upd[0]?.title.endsWith("v2"), "ME edits an activity");

const sched = must(await me.sb.from("schedules").insert({
  service_id: svc.id, title: `${tag} weekly`, start_time: "08:00", end_time: "09:00", recurrence: "weekly",
  weekdays: [0, 1, 2, 3, 4, 5, 6], start_date: today, checklist: ["x"], created_by: me.id,
}).select("id").single(), "create schedule");
const gen = must(await me.sb.rpc("generate_schedule_activities", { p_schedule: sched.id, p_until: iso(new Date(Date.now() + 6 * 864e5)) }), "generate");
ok(gen === 7, "Recurring weekly (all days) generates 7 activities", `got ${gen}`);
must(await me.sb.rpc("extend_my_schedules", { p_days: 90 }), "extend");
const stopped = must(await me.sb.rpc("stop_schedule", { p_schedule: sched.id }), "stop");
ok(stopped >= 7, "Stop schedule removes future unobserved activities", `got ${stopped}`);

// other ME cannot edit mine
const hijack = await meOther.sb.from("activities").update({ title: "hijack" }).eq("id", created.id).select("id");
ok(!hijack.error && hijack.data.length === 0, "Other ME cannot edit my activity");

// ---------- SE: day view and observation
const day = must(await se1.sb.from("activities").select(ACT_SELECT).gte("activity_date", today).lte("activity_date", today).order("start_time"), "SE day list");
ok(day.some((a) => a.id === created.id), "SE day list (with embeds) shows the activity");

const obs = must(await se1.sb.from("observations").insert({
  activity_id: created.id, submitted_by: se1.id, monitored: true,
  checklist_results: [{ item: "Door safe", done: true }, { item: "Readings noted", done: false }], remarks: "Feeder 3 warm",
}).select("id").single(), "SE observation");
const path = `${obs.id}/${crypto.randomUUID()}.jpg`;
const up = await se1.sb.storage.from("observation-photos").upload(path, JPEG, { contentType: "image/jpeg" });
ok(!up.error, "SE uploads a photo to the private bucket", up.error?.message);
const pr = await se1.sb.from("observation_photos").insert({ observation_id: obs.id, storage_path: path });
ok(!pr.error, "SE links photo to observation", pr.error?.message);

const sel = await se1.sb.from("observations").update({ status: "resolved" }).eq("id", obs.id).select("id");
ok(!!sel.error, "SE cannot set status by direct update");
const edit = must(await se1.sb.from("observations").update({ remarks: "Feeder 3 warm (updated)" }).eq("id", obs.id).select("remarks"), "SE edit own");
ok(edit[0]?.remarks.includes("updated"), "SE edits own open observation");

// ---------- ME / GM see it, with photos
for (const [who, u] of [["ME owner", me], ["GM", gm], ["SE2", se2]]) {
  const o = must(await u.sb.from("observations").select(OBS_SELECT).eq("id", obs.id).maybeSingle(), `${who} read`);
  ok(o && o.observation_photos.length === 1 && o.submitter?.full_name, `${who} sees the observation with photo and submitter`);
  if (who === "GM") {
    const s = await u.sb.storage.from("observation-photos").createSignedUrls([path], 300);
    const res = await fetch(s.data[0].signedUrl);
    ok(res.status === 200, "Photo opens via signed URL", `HTTP ${res.status}`);
    const anon = await fetch(`${URL_}/storage/v1/object/public/observation-photos/${path}`);
    ok(anon.status !== 200, "Photo is NOT public", `HTTP ${anon.status}`);
  }
}

// ---------- notifications
const nGm = must(await gm.sb.from("notifications").select("*").eq("observation_id", obs.id), "gm notif");
const nMe = must(await me.sb.from("notifications").select("*").eq("observation_id", obs.id), "me notif");
ok(nGm.length === 1 && nMe.length === 1, "GM and owning ME are notified of the new observation");

// ---------- remarks
const r1 = await me.sb.from("observation_remarks").insert({ observation_id: obs.id, author_id: me.id, author_role: "me", body: "Re-torque and retest", kind: "remark" });
ok(!r1.error, "ME owner posts a remark", r1.error?.message);
const r2 = await gm.sb.from("observation_remarks").insert({ observation_id: obs.id, author_id: gm.id, author_role: "gm", body: "Expedite please", kind: "remark" });
ok(!r2.error, "GM posts a remark", r2.error?.message);
const r3 = await se1.sb.from("observation_remarks").insert({ observation_id: obs.id, author_id: se1.id, author_role: "se", body: "sneaky", kind: "remark" });
ok(!!r3.error, "SE cannot post a remark");
const r4 = await meOther.sb.from("observation_remarks").insert({ observation_id: obs.id, author_id: meOther.id, author_role: "me", body: "not mine", kind: "remark" });
ok(!!r4.error, "Other ME cannot post a remark");
const nSe2 = must(await se2.sb.from("notifications").select("*").eq("observation_id", obs.id).eq("kind", "remark"), "se2 notif");
ok(nSe2.length === 2, "All shift engineers are notified of both remarks", `got ${nSe2.length}`);
const readRes = await se2.sb.from("notifications").update({ read: true }).eq("observation_id", obs.id);
ok(!readRes.error, "Notifications can be marked read");

// ---------- resolve / reopen
const rv = await meOther.sb.rpc("set_observation_status", { p_obs: obs.id, p_status: "resolved", p_note: "x" });
ok(!!rv.error, "Other ME cannot resolve");
const rs = await se2.sb.rpc("set_observation_status", { p_obs: obs.id, p_status: "resolved", p_note: "Retorqued, retested OK" });
ok(!rs.error, "SE resolves with a closing note", rs.error?.message);
const rsNoNote = await gm.sb.rpc("set_observation_status", { p_obs: obs.id, p_status: "open", p_note: "  " });
ok(!!rsNoNote.error, "Reopen needs a note");
const ro1 = await se1.sb.rpc("set_observation_status", { p_obs: obs.id, p_status: "open", p_note: "again" });
ok(!!ro1.error, "SE cannot reopen");
const ro2 = await gm.sb.rpc("set_observation_status", { p_obs: obs.id, p_status: "open", p_note: "Issue recurred" });
ok(!ro2.error, "GM reopens", ro2.error?.message);
const full = must(await gm.sb.from("observations").select(OBS_SELECT).eq("id", obs.id).single(), "thread");
ok(full.status === "open" && full.observation_remarks.length === 4, "Thread shows 2 remarks + resolve + reopen, status open", `status ${full.status}, ${full.observation_remarks.length} entries`);
await se1.sb.rpc("set_observation_status", { p_obs: obs.id, p_status: "resolved", p_note: "Final" });

// ---------- feeds, GM dashboard
const feed = must(await me.sb.from("observations").select("id, status, remarks, created_at, submitter:profiles!submitted_by(full_name), activities(title, activity_date, start_time, end_time, services(name, owner_me_id)), observation_remarks(id)").order("created_at", { ascending: false }).limit(100), "feed");
ok(feed.some((o) => o.id === obs.id), "Observations feed query works");
const dash = must(await gm.sb.from("activities").select("id, title, activity_date, start_time, end_time, priority, services(name), observations(id, status, submitter:profiles!submitted_by(full_name))").gte("activity_date", today).lte("activity_date", today).order("activity_date").order("start_time").limit(2000), "dash");
ok(dash.length >= 4 && dash.some((a) => a.observations.length > 0), "GM overview query works");

// ---------- admin
const sv = must(await admin.sb.from("services").insert({ name: `${tag} svc`, location: "T1", owner_me_id: me.id }).select("id").single(), "admin add service");
const meAdd = await me.sb.from("services").insert({ name: `${tag} svc2` });
ok(!!meAdd.error, "ME cannot create services");
must(await admin.sb.from("services").delete().eq("id", sv.id), "admin delete service");

// ---------- cleanup of this run's data
must(await admin.sb.from("activities").delete().like("title", `${tag}%`), "cleanup");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
