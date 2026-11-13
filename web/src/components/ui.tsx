"use client";

import type { ReactNode } from "react";
import type { ObsStatus, Priority } from "@/lib/types";
import type { ActivityState } from "@/lib/time";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">{children}</div>;
}

/** Minimal status marker: a coloured dot + quiet label (no filled pills). */
function Dot({ color, label, strong }: { color: string; label: string; strong?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs capitalize ${strong ? "font-semibold text-zinc-900" : "font-medium text-zinc-500"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

const PRIO_DOT: Record<Priority, string> = {
  low: "bg-zinc-300",
  medium: "bg-sky-400",
  high: "bg-amber-500",
  critical: "bg-red-500",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Dot color={PRIO_DOT[priority]} label={priority} strong={priority === "critical"} />;
}

export function StatusBadge({ status }: { status: ObsStatus }) {
  return status === "open" ? (
    <Dot color="bg-amber-500" label="Open" strong />
  ) : (
    <Dot color="bg-emerald-500" label="Resolved" />
  );
}

const STATE_DOT: Record<ActivityState, string> = {
  running: "bg-emerald-500 animate-pulse",
  upcoming: "bg-sky-400",
  past: "bg-zinc-300",
};
const STATE_LABEL: Record<ActivityState, string> = { running: "Now", upcoming: "Upcoming", past: "Window over" };

export function StateChip({ state }: { state: ActivityState }) {
  return <Dot color={STATE_DOT[state]} label={STATE_LABEL[state]} strong={state === "running"} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function PageTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {action}
    </div>
  );
}
