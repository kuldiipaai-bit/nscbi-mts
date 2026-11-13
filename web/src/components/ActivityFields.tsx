"use client";

import { PRIORITIES, type Priority, type Service } from "@/lib/types";
import { Field } from "./ui";

export interface ActivityDraft {
  service_id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  priority: Priority;
  agency: string;
  checklist: string; // one item per line
}

export const emptyDraft = (service_id = ""): ActivityDraft => ({
  service_id,
  title: "",
  description: "",
  location: "",
  start_time: "09:00",
  end_time: "10:00",
  priority: "medium",
  agency: "",
  checklist: "",
});

export const checklistFromText = (t: string) =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Shared field block for one-off activities and recurring schedules. */
export function ActivityFields({
  value,
  onChange,
  services,
}: {
  value: ActivityDraft;
  onChange: (v: ActivityDraft) => void;
  services: Service[];
}) {
  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <Field label="Service">
        <select
          className="input"
          value={value.service_id}
          onChange={(e) => {
            const svc = services.find((s) => s.id === e.target.value);
            onChange({ ...value, service_id: e.target.value, location: value.location || svc?.location || "" });
          }}
          required
        >
          <option value="">Select service...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Activity title">
        <input className="input" value={value.title} onChange={(e) => set("title", e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time">
          <input type="time" className="input" value={value.start_time} onChange={(e) => set("start_time", e.target.value)} required />
        </Field>
        <Field label="End time" hint="If earlier than start, it ends next day">
          <input type="time" className="input" value={value.end_time} onChange={(e) => set("end_time", e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">
          <input className="input" value={value.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Priority">
          <select className="input capitalize" value={value.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Agency / contractor">
        <input className="input" value={value.agency} onChange={(e) => set("agency", e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea className="input min-h-[72px]" value={value.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field label="Checklist (one item per line)" hint="Shift engineers tick these during the visit">
        <textarea className="input min-h-[96px]" value={value.checklist} onChange={(e) => set("checklist", e.target.value)} />
      </Field>
    </div>
  );
}
