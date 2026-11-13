import type { Priority, Service } from "./types";
import { PRIORITIES } from "./types";
import { pad, toISODate } from "./time";

export type RawRow = Record<string, unknown>;

export interface DraftActivity {
  service_id: string;
  service_name: string;
  title: string;
  description: string | null;
  location: string | null;
  activity_date: string;
  start_time: string; // HH:MM
  end_time: string;
  priority: Priority;
  agency: string | null;
  checklist: string[];
}

export interface RowError {
  row: number; // spreadsheet row number (header = 1)
  message: string;
}

export interface ImportResult {
  ok: DraftActivity[];
  errors: RowError[];
}

export const TEMPLATE_HEADERS = [
  "service",
  "title",
  "date",
  "start_time",
  "end_time",
  "location",
  "description",
  "priority",
  "agency",
  "checklist",
];

export const TEMPLATE_EXAMPLE = [
  "Electrical - Terminal LT Panels",
  "LT panel thermography",
  "2026-11-20",
  "06:00",
  "10:00",
  "Substation 1",
  "Thermal scan of main LT panels",
  "high",
  "M/s PowerCheck",
  "Panel door safe to open; Hot-spot readings recorded",
];

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export function parseDateCell(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Depending on the parser, a date cell is midnight UTC or midnight local time.
    // Pick the interpretation that lands exactly on midnight so the day never shifts.
    if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0) {
      return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    }
    return toISODate(v);
  }
  if (typeof v === "number" && isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000); // Excel serial -> unix
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = str(v);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // DD/MM/YYYY (Indian format)
  if (m) return validDate(+m[3], +m[2], +m[1]);
  return null;
}

function validDate(y: number, mo: number, d: number): string | null {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return toISODate(dt);
}

export function parseTimeCell(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  }
  if (typeof v === "number" && isFinite(v) && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  }
  const s = str(v).toLowerCase();
  let m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/.exec(s);
  if (!m) m = /^(\d{2})(\d{2})()$/.exec(s); // 0600
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

export function parseChecklist(v: unknown): string[] {
  return str(v)
    .split(/[;|\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Lower-case header keys, tolerate spaces/underscores/hyphens. */
export function normalizeKeys(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase().replace(/[\s-]+/g, "_")] = v;
  }
  return out;
}

export function normalizeRows(rawRows: RawRow[], services: Service[]): ImportResult {
  const byName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]));
  const ok: DraftActivity[] = [];
  const errors: RowError[] = [];

  rawRows.forEach((raw, i) => {
    const rowNo = i + 2;
    const r = normalizeKeys(raw);
    if (Object.values(r).every((v) => str(v) === "")) return; // skip blank lines

    const problems: string[] = [];
    const serviceName = str(r.service);
    const svc = byName.get(serviceName.toLowerCase());
    if (!serviceName) problems.push("service is required");
    else if (!svc) problems.push(`unknown service "${serviceName}" (or not owned by you)`);

    const title = str(r.title);
    if (!title) problems.push("title is required");

    const date = parseDateCell(r.date);
    if (!date) problems.push("date must be YYYY-MM-DD or DD/MM/YYYY");

    const start = parseTimeCell(r.start_time);
    if (!start) problems.push("start_time must be HH:MM");
    const end = parseTimeCell(r.end_time);
    if (!end) problems.push("end_time must be HH:MM");

    const prio = str(r.priority).toLowerCase() || "medium";
    if (!PRIORITIES.includes(prio as Priority)) problems.push("priority must be low/medium/high/critical");

    if (problems.length || !svc || !date || !start || !end) {
      errors.push({ row: rowNo, message: problems.join("; ") });
      return;
    }
    ok.push({
      service_id: svc.id,
      service_name: svc.name,
      title,
      description: str(r.description) || null,
      location: str(r.location) || svc.location || null,
      activity_date: date,
      start_time: start,
      end_time: end,
      priority: prio as Priority,
      agency: str(r.agency) || null,
      checklist: parseChecklist(r.checklist),
    });
  });

  return { ok, errors };
}

/** Read a .csv or .xlsx file into raw row objects keyed by header. */
export async function readSheet(file: File): Promise<RawRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve, reject) => {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: (err: Error) => reject(err),
      });
    });
  }
  if (name.endsWith(".xlsx")) {
    const readXlsxFile = (await import("read-excel-file")).default;
    const rows = await readXlsxFile(file);
    if (rows.length === 0) return [];
    const headers = rows[0].map((h) => str(h));
    return rows.slice(1).map((cells) => {
      const o: RawRow = {};
      headers.forEach((h, idx) => {
        if (h) o[h] = cells[idx];
      });
      return o;
    });
  }
  throw new Error("Please upload a .xlsx or .csv file");
}

export function templateCsv(): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [TEMPLATE_HEADERS.join(","), TEMPLATE_EXAMPLE.map(esc).join(",")].join("\r\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob(["﻿" + text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
