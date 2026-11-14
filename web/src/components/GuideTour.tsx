"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

type RoleKey = "se" | "me" | "gm";
type Tone = "green" | "blue" | "amber" | "red" | "gray";

/* Mock-screen colours are fixed (not theme classes) so the phone looks the same in light and dark mode. */
const TONE: Record<Tone, string> = {
  green: "bg-[#d1fae5] text-[#065f46]",
  blue: "bg-[#dbeafe] text-[#1e40af]",
  amber: "bg-[#fef3c7] text-[#92400e]",
  red: "bg-[#fee2e2] text-[#991b1b]",
  gray: "bg-[#e4e4e7] text-[#52525b]",
};

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

/** Pulsing ring that shows where to tap. */
function Pulse({ children }: { children: ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <span className="tg-ring" aria-hidden="true" />
    </span>
  );
}

/** Fades and slides its content in, after an optional delay (ms). */
function In({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  return (
    <div className="tg-in" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[8px] font-medium uppercase tracking-wide text-[#71717a]">{label}</div>
      <div className="min-h-[24px] rounded-md border border-[#d4d4d8] bg-[#ffffff] px-2 py-1 text-[11px] text-[#18181b]">{children}</div>
    </div>
  );
}

function Btn({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "green" | "light" }) {
  const c =
    tone === "green"
      ? "bg-[#059669] text-[#ffffff]"
      : tone === "light"
        ? "border border-[#d4d4d8] bg-[#ffffff] text-[#18181b]"
        : "bg-[#18181b] text-[#ffffff]";
  return <div className={`rounded-md px-3 py-1.5 text-center text-[11px] font-semibold ${c}`}>{children}</div>;
}

function Box({ done, delay = 0 }: { done: boolean; delay?: number }) {
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-[#a1a1aa] bg-[#ffffff]">
      {done && <span className="tg-tick block h-2 w-2 rounded-[1px] bg-[#18181b]" style={{ animationDelay: `${delay}ms` }} />}
    </span>
  );
}

function Check({ done, delay, children }: { done: boolean; delay?: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#e4e4e7] bg-[#ffffff] px-2 py-1.5 text-[10px] text-[#18181b]">
      <Box done={done} delay={delay} />
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-[#e4e4e7] bg-[#ffffff] p-2 text-[#18181b] ${className}`}>{children}</div>;
}

function Photo({ delay = 0 }: { delay?: number }) {
  return (
    <div className="tg-in h-12 w-12 rounded-md bg-gradient-to-br from-[#a1a1aa] to-[#52525b]" style={{ animationDelay: `${delay}ms` }}>
      <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
        <path d="M4 40 L18 22 L28 34 L34 27 L44 40 Z" fill="#e4e4e7" opacity="0.7" />
        <circle cx="35" cy="12" r="4" fill="#fafafa" opacity="0.8" />
      </svg>
    </div>
  );
}

function Phone({ nav, active, badge, children }: { nav?: string[]; active: number; badge?: number; children: ReactNode }) {
  return (
    <div className="relative mx-auto h-[470px] w-[250px] overflow-hidden rounded-[30px] border-[7px] border-[#27272a] bg-[#f4f4f5] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#e4e4e7] bg-[#ffffff] px-3 py-2">
        <span className="text-[10px] font-semibold text-[#18181b]">Maintenance Tracker</span>
        <span className="relative text-[9px] text-[#71717a]">
          Bell
          {badge ? (
            <span className="tg-pop absolute -right-3 -top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#dc2626] text-[8px] font-bold text-[#ffffff]">
              {badge}
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-[372px] overflow-hidden">{children}</div>
      {nav && (
        <div className="absolute inset-x-0 bottom-0 flex border-t border-[#e4e4e7] bg-[#ffffff]">
          {nav.map((n, i) => (
            <div key={n} className={`min-w-0 flex-1 py-2 text-center ${nav.length > 4 ? "text-[7px]" : "text-[8px]"} font-medium ${i === active ? "text-[#18181b]" : "text-[#a1a1aa]"}`}>
              {i === active && <div className="mx-auto mb-0.5 h-0.5 w-5 rounded bg-[#18181b]" />}
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Shift Engineer screens ----------------------------- */

function SeSignIn() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-5">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#18181b] text-[11px] font-bold text-[#ffffff]">MT</div>
      <div className="text-center text-xs font-semibold text-[#18181b]">Sign in</div>
      <Field label="Login ID">
        <span className="tg-type">se1</span>
      </Field>
      <Field label="Password">********</Field>
      <Pulse>
        <Btn>Sign in</Btn>
      </Pulse>
    </div>
  );
}

function ActivityRow({ time, title, service, tag, tone, pulse }: { time: string; title: string; service: string; tag: string; tone: Tone; pulse?: boolean }) {
  const chip = <Chip tone={tone}>{tag}</Chip>;
  return (
    <Card>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[9px] font-semibold">{time}</span>
        {pulse ? <span className="relative inline-block">{chip}<span className="tg-ring" aria-hidden="true" /></span> : chip}
      </div>
      <div className="text-[11px] font-semibold">{title}</div>
      <div className="text-[9px] text-[#71717a]">{service}</div>
    </Card>
  );
}

function SeToday() {
  return (
    <div className="space-y-2 p-3">
      <div className="text-sm font-semibold text-[#18181b]">Today</div>
      <In delay={0}>
        <ActivityRow time="08:00 - 16:00" title="Chiller 2 maintenance" service="HVAC" tag="Now" tone="green" pulse />
      </In>
      <In delay={250}>
        <ActivityRow time="10:00 - 13:00" title="Escalator E1-E4 service" service="Escalators" tag="Upcoming" tone="blue" />
      </In>
      <In delay={500}>
        <ActivityRow time="22:00 - 02:00" title="Terminal lighting check" service="Internal Lighting" tag="Upcoming" tone="blue" />
      </In>
    </div>
  );
}

function SeOpen() {
  return (
    <div className="space-y-2 p-3">
      <In>
        <Card>
          <div className="text-[11px] font-semibold">Escalator E1-E4 service</div>
          <div className="text-[9px] text-[#71717a]">10:00 - 13:00 · Escalators · Departure level</div>
        </Card>
      </In>
      <In delay={300}>
        <Pulse>
          <Card>
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#71717a]">Checklist</div>
            <ul className="space-y-1 text-[10px]">
              <li>Handrail speed matches steps</li>
              <li>Emergency stop test</li>
              <li>Comb plate condition</li>
              <li>Lubrication points done</li>
            </ul>
          </Card>
        </Pulse>
      </In>
    </div>
  );
}

function SeRecord() {
  return (
    <div className="space-y-1.5 p-3">
      <div className="text-[11px] font-semibold text-[#18181b]">Record my observation</div>
      <Check done delay={200}>I visited and monitored this</Check>
      <Check done delay={700}>Handrail speed matches steps</Check>
      <Check done={false}>Emergency stop test</Check>
      <Field label="Remarks">
        <span className="tg-type" style={{ animationDelay: "1.1s" }}>E3 handrail rough</span>
      </Field>
      <div className="flex gap-1.5">
        <Photo delay={1800} />
        <Photo delay={2100} />
      </div>
      <Pulse>
        <Btn>Submit observation</Btn>
      </Pulse>
    </div>
  );
}

function SeFollow() {
  return (
    <div className="space-y-2 p-3">
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold">Escalator E1-E4 service</span>
          <Chip tone="amber">Open</Chip>
        </div>
        <div className="text-[10px] text-[#52525b]">E3 handrail rough</div>
      </Card>
      <In delay={500}>
        <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-2 text-[10px] text-[#18181b]">
          <div className="mb-0.5 text-[8px] text-[#71717a]">Maintenance Engineer</div>
          Please re-torque and retest.
        </div>
      </In>
      <In delay={1100}>
        <Pulse>
          <Btn tone="green">Mark as resolved</Btn>
        </Pulse>
      </In>
    </div>
  );
}

/* --------------------------- Maintenance Engineer screens --------------------------- */

function MeAdd() {
  return (
    <div className="space-y-1.5 p-3">
      <div className="text-[11px] font-semibold text-[#18181b]">Add activity</div>
      <Field label="Service">Lifts</Field>
      <Field label="Activity title">
        <span className="tg-type">Lift L1-L4 inspection</span>
      </Field>
      <div className="flex gap-1.5">
        <div className="flex-1"><Field label="Start">09:00</Field></div>
        <div className="flex-1"><Field label="End">12:00</Field></div>
      </div>
      <Field label="Checklist">Door sensor test</Field>
      <Pulse>
        <Btn>Add activity</Btn>
      </Pulse>
    </div>
  );
}

function MeImport() {
  return (
    <div className="space-y-2 p-3">
      <div className="text-[11px] font-semibold text-[#18181b]">Bulk import</div>
      <In>
        <Pulse>
          <div className="rounded-md border border-dashed border-[#a1a1aa] bg-[#ffffff] px-2 py-2 text-center text-[10px] text-[#52525b]">may-schedule.xlsx</div>
        </Pulse>
      </In>
      <In delay={500}>
        <Card className="space-y-1 text-[10px]">
          <div className="flex justify-between"><span>20/05 Lift L1 inspection</span><Chip tone="green">Ready</Chip></div>
          <div className="flex justify-between"><span>21/05 Lift L2 inspection</span><Chip tone="green">Ready</Chip></div>
          <div className="flex justify-between"><span>22/05 Lift L9 inspection</span><Chip tone="red">Row 4 problem</Chip></div>
        </Card>
      </In>
      <In delay={1000}>
        <Btn>Import 2 activities</Btn>
      </In>
    </div>
  );
}

function MeRecurring() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="space-y-2 p-3">
      <div className="text-[11px] font-semibold text-[#18181b]">Recurring schedule</div>
      <div className="flex gap-1 text-[9px]">
        {["Daily", "Weekly", "Monthly", "Quarterly"].map((r) => (
          <span key={r} className={`flex-1 rounded-md py-1 text-center font-semibold ${r === "Weekly" ? "bg-[#18181b] text-[#ffffff]" : "border border-[#d4d4d8] bg-[#ffffff] text-[#52525b]"}`}>
            {r}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {days.map((d, i) => {
          const on = d === "Mon" || d === "Thu";
          return (
            <span
              key={d}
              className={`${on ? "tg-tick bg-[#18181b] text-[#ffffff]" : "border border-[#d4d4d8] bg-[#ffffff] text-[#52525b]"} flex h-7 flex-1 items-center justify-center rounded-md text-[8px] font-semibold`}
              style={on ? { animationDelay: `${400 + i * 120}ms` } : undefined}
            >
              {d}
            </span>
          );
        })}
      </div>
      <In delay={1000}>
        <Card className="text-[10px] text-[#52525b]">Activities are created about 90 days ahead. Stop it any time.</Card>
      </In>
      <Pulse>
        <Btn>Create schedule</Btn>
      </Pulse>
    </div>
  );
}

function ObsRow({ title, note, who, status, pulse }: { title: string; note: string; who: string; status: string; pulse?: boolean }) {
  const inner = (
    <Card>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold">{title}</span>
        <Chip tone="amber">{status}</Chip>
      </div>
      <div className="text-[9px] text-[#71717a]">{who}</div>
      <div className="mt-0.5 text-[10px] text-[#3f3f46]">{note}</div>
    </Card>
  );
  return pulse ? <Pulse>{inner}</Pulse> : inner;
}

function MeObservations() {
  return (
    <div className="space-y-2 p-3">
      <div className="text-sm font-semibold text-[#18181b]">Observations</div>
      <In>
        <ObsRow title="Lifts · L3 inspection" who="se2 · today 10:40" note="Door sensor slow to react on level 2." status="Open" pulse />
      </In>
      <In delay={350}>
        <ObsRow title="Escalators · E3 repair" who="se1 · today 09:15" note="Handrail rough, part needed." status="Open" />
      </In>
    </div>
  );
}

function MeReply() {
  return (
    <div className="space-y-2 p-3">
      <Card>
        <div className="mb-0.5 text-[10px] font-semibold">Lifts · L3 inspection</div>
        <div className="text-[10px] text-[#3f3f46]">Door sensor slow to react on level 2.</div>
      </Card>
      <Field label="Remark for everyone">
        <span className="tg-type" style={{ animationDuration: "2s" }}>Technician comes at 15:00</span>
      </Field>
      <In delay={2200}>
        <Pulse>
          <Btn>Post remark</Btn>
        </Pulse>
      </In>
      <In delay={2800}>
        <Btn tone="green">Mark as resolved</Btn>
      </In>
    </div>
  );
}

/* ----------------------------------- GM screens ----------------------------------- */

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="flex-1">
      <div className="text-[8px] uppercase tracking-wide text-[#71717a]">{label}</div>
      <div className={`text-base font-semibold ${tone ?? ""}`}>{value}</div>
    </Card>
  );
}

function Bar({ name, pct, delay }: { name: string; pct: number; delay: number }) {
  return (
    <div className="flex items-center gap-2 text-[9px] text-[#3f3f46]">
      <span className="w-14 shrink-0">{name}</span>
      <span className="h-2 flex-1 rounded bg-[#e4e4e7]">
        <span className="tg-bar block h-2 rounded bg-[#18181b]" style={{ width: `${pct}%`, animationDelay: `${delay}ms` }} />
      </span>
    </div>
  );
}

function GmOverview({ printPulse }: { printPulse?: boolean }) {
  const print = <div className="rounded-md bg-[#18181b] px-2 py-1 text-[9px] font-semibold text-[#ffffff]">Print report</div>;
  const csv = <div className="rounded-md border border-[#d4d4d8] bg-[#ffffff] px-2 py-1 text-[9px] font-semibold text-[#18181b]">Export CSV</div>;
  return (
    <div className="space-y-2 p-3">
      <div className="text-sm font-semibold text-[#18181b]">Overview</div>
      <div className="flex gap-1.5">
        {printPulse ? <Pulse>{print}</Pulse> : print}
        {csv}
      </div>
      <div className="flex gap-1.5">
        <Kpi label="Activities" value="21" />
        <Kpi label="Monitored" value="76%" />
      </div>
      <div className="flex gap-1.5">
        <Kpi label="Open" value="4" tone="text-[#d97706]" />
        <Kpi label="Critical" value="1" tone="text-[#dc2626]" />
      </div>
      <Card className="space-y-1.5">
        <div className="text-[8px] font-semibold uppercase tracking-wide text-[#71717a]">By service</div>
        <Bar name="Lifts" pct={85} delay={200} />
        <Bar name="HVAC" pct={60} delay={400} />
        <Bar name="Fire" pct={100} delay={600} />
        <Bar name="Lighting" pct={40} delay={800} />
      </Card>
    </div>
  );
}

function GmRead() {
  return (
    <div className="space-y-2 p-3">
      <div className="flex gap-1 text-[9px]">
        <span className="rounded-md bg-[#18181b] px-2 py-1 font-semibold text-[#ffffff]">Open</span>
        <span className="rounded-md border border-[#d4d4d8] bg-[#ffffff] px-2 py-1 text-[#52525b]">Resolved</span>
        <span className="rounded-md border border-[#d4d4d8] bg-[#ffffff] px-2 py-1 text-[#52525b]">All</span>
      </div>
      <In>
        <Pulse>
          <Card>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold">Fire Fighting · Hydrant valves</span>
              <Chip tone="amber">Open</Chip>
            </div>
            <div className="mb-1 text-[10px] text-[#3f3f46]">Hydrant 7 valve is stuck.</div>
            <div className="flex gap-1.5">
              <Photo delay={300} />
              <Photo delay={500} />
            </div>
          </Card>
        </Pulse>
      </In>
    </div>
  );
}

function GmRemark() {
  return (
    <div className="space-y-2 p-3">
      <Card>
        <div className="text-[10px] font-semibold">Fire Fighting · Hydrant valves</div>
        <div className="text-[10px] text-[#3f3f46]">Hydrant 7 valve is stuck.</div>
      </Card>
      <In delay={200}>
        <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-2 text-[10px] text-[#18181b]">
          <div className="mb-0.5 text-[8px] text-[#71717a]">Maintenance Engineer</div>
          Valve will be freed tonight.
        </div>
      </In>
      <Field label="Your remark">
        <span className="tg-type" style={{ animationDelay: "0.8s", animationDuration: "2s" }}>Replace within 48 hours</span>
      </Field>
      <In delay={2900}>
        <Pulse>
          <Btn>Post remark</Btn>
        </Pulse>
      </In>
    </div>
  );
}

function GmClose() {
  return (
    <div className="space-y-2 p-3">
      <Card>
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold">Hydrant valves</span>
          <Chip tone="amber">Open</Chip>
        </div>
        <div className="text-[10px] text-[#3f3f46]">Valve replaced and tested.</div>
      </Card>
      <Field label="Closing note">
        <span className="tg-type">Checked, working</span>
      </Field>
      <In delay={1300}>
        <Pulse>
          <Btn tone="green">Mark as resolved</Btn>
        </Pulse>
      </In>
      <In delay={1900}>
        <div className="text-center text-[9px] text-[#71717a]">Problem comes back? Press Reopen.</div>
      </In>
    </div>
  );
}

/* --------------------------------------- Tours --------------------------------------- */

interface Step {
  title: string;
  text: string;
  screen: ReactNode;
  active: number; // highlighted bottom tab
  hideNav?: boolean;
  badge?: number;
}

interface Tour {
  label: string;
  intro: string;
  nav: string[];
  steps: Step[];
}

const TOURS: Record<RoleKey, Tour> = {
  se: {
    label: "Shift Engineer",
    intro: "Check the work on site and record what you see.",
    nav: ["Today", "Observations"],
    steps: [
      { title: "Sign in", text: "Type your Login ID and password.", screen: <SeSignIn />, active: 0, hideNav: true },
      { title: "See today's work", text: "Every activity of the day is listed by time. Green Now means it is running at this minute.", screen: <SeToday />, active: 0 },
      { title: "Open an activity", text: "Tap it to read the details and the checklist.", screen: <SeOpen />, active: 0 },
      { title: "Record what you saw", text: "After visiting the site: tick visited, tick the checklist, write a note, add up to 4 photos, then press Submit.", screen: <SeRecord />, active: 0 },
      { title: "Follow up", text: "The bell shows replies from the Maintenance Engineer and the General Manager. When it is fixed, mark it Resolved.", screen: <SeFollow />, active: 1, badge: 1 },
    ],
  },
  me: {
    label: "Maintenance Engineer",
    intro: "Plan the work for your services and answer what is found.",
    nav: ["Schedule", "Add", "Import", "Recurring", "Observations"],
    steps: [
      { title: "Add a task", text: "Choose the service, date, start and end time. Add a checklist if you want.", screen: <MeAdd />, active: 1 },
      { title: "Upload many at once", text: "Fill the CSV template or an Excel sheet, upload it, check the preview, then press Import.", screen: <MeImport />, active: 2 },
      { title: "Repeat automatically", text: "For regular work choose Daily, Weekly, Monthly or Quarterly once.", screen: <MeRecurring />, active: 3 },
      { title: "See what was found", text: "The Observations tab shows notes and photos from the shift engineers on your services.", screen: <MeObservations />, active: 4, badge: 2 },
      { title: "Reply and close", text: "Write what must be done. Every shift engineer sees it. Mark it Resolved when finished.", screen: <MeReply />, active: 4 },
    ],
  },
  gm: {
    label: "General Manager",
    intro: "See everything in one place and give direction.",
    nav: ["Overview", "Day view", "Observations"],
    steps: [
      { title: "See the whole picture", text: "Pick the dates. See how much work was planned, how much was checked, and what is still open.", screen: <GmOverview />, active: 0 },
      { title: "Read an observation", text: "Open any one to see the note, the checklist and the photos.", screen: <GmRead />, active: 2, badge: 3 },
      { title: "Give direction", text: "Post a remark. The engineer in charge and all shift engineers are told.", screen: <GmRemark />, active: 2 },
      { title: "Close or reopen", text: "Mark it Resolved with a short note, or reopen it if the problem comes back.", screen: <GmClose />, active: 2 },
      { title: "Take a report", text: "On the Overview press Print report, then choose Save as PDF. You get a one-page report to send or print.", screen: <GmOverview printPulse />, active: 0 },
    ],
  },
};

const ROLE_ORDER: RoleKey[] = ["se", "me", "gm"];
const STEP_MS = 6000;

export function GuideTour() {
  const [role, setRole] = useState<RoleKey>("se");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  const tour = TOURS[role];
  const step = tour.steps[i];
  const auto = playing && !reduced;

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // Direct links: /guide/?role=gm opens the GM tour, &step=3 opens its third step (and stays there).
    const q = new URLSearchParams(window.location.search);
    const r = q.get("role");
    if (r === "se" || r === "me" || r === "gm") {
      setRole(r);
      const n = Number(q.get("step"));
      if (Number.isInteger(n) && n >= 1 && n <= TOURS[r].steps.length) {
        setI(n - 1);
        setPlaying(false);
      }
    }
  }, []);

  // Move to the next step on a timer; stops when the reader takes control.
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setI((x) => (x + 1) % TOURS[role].steps.length), STEP_MS);
    return () => clearTimeout(t);
  }, [auto, i, role]);

  function pick(r: RoleKey) {
    setRole(r);
    setI(0);
    setPlaying(true);
  }
  function go(n: number) {
    setPlaying(false);
    setI((n + tour.steps.length) % tour.steps.length);
  }

  return (
    <div>
      <div role="tablist" aria-label="Choose your role" className="mb-5 flex flex-wrap justify-center gap-2">
        {ROLE_ORDER.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={role === r}
            onClick={() => pick(r)}
            className={`btn ${role === r ? "btn-primary" : "btn-secondary"}`}
          >
            {TOURS[r].label}
          </button>
        ))}
      </div>

      <p className="mb-6 text-center text-sm text-zinc-500">{tour.intro}</p>

      <div className="grid items-center gap-8 md:grid-cols-[270px_1fr]">
        <div key={`${role}-${i}`}>
          <Phone nav={step.hideNav ? undefined : tour.nav} active={step.active} badge={step.badge}>
            {step.screen}
          </Phone>
        </div>

        <div aria-live="polite">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Step {i + 1} of {tour.steps.length}
          </p>
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900">{step.title}</h2>
          <p className="mb-5 text-base text-zinc-600">{step.text}</p>

          <div className="mb-4 h-1 overflow-hidden rounded-full bg-zinc-200">
            {auto && <div key={`${role}-${i}`} className="tg-progress h-1 rounded-full bg-zinc-900" style={{ animationDuration: `${STEP_MS}ms` }} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={() => go(i - 1)}>
              Back
            </button>
            <button className="btn btn-secondary" onClick={() => setPlaying(!playing)} disabled={reduced}>
              {auto ? "Pause" : "Play"}
            </button>
            <button className="btn btn-primary" onClick={() => go(i + 1)}>
              Next
            </button>
          </div>

          <div className="mt-4 flex gap-1.5" aria-label="Steps">
            {tour.steps.map((s, n) => (
              <button
                key={s.title}
                aria-label={`Step ${n + 1}: ${s.title}`}
                aria-current={n === i}
                onClick={() => go(n)}
                className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-zinc-900" : "w-2 bg-zinc-300"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link href="/login/" className="btn btn-primary">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
