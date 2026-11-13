"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote, PageTitle, PriorityBadge, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { downloadText, ImportResult, normalizeRows, readSheet, templateCsv } from "@/lib/excel";
import { useMyServices } from "@/lib/services";
import { supabase } from "@/lib/supabase";

export default function ImportPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { data: services, loading } = useMyServices();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !services) return;
    setError(null);
    setResult(null);
    try {
      const rows = await readSheet(file);
      setResult(normalizeRows(rows, services));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doImport() {
    if (!result || !profile) return;
    setBusy(true);
    setError(null);
    const payload = result.ok.map(({ service_name: _n, ...r }) => ({ ...r, created_by: profile.id }));
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase().from("activities").insert(payload.slice(i, i + 200));
      if (error) {
        setBusy(false);
        return setError(`Import stopped at row group ${i / 200 + 1}: ${error.message}`);
      }
    }
    setBusy(false);
    router.replace("/me/");
  }

  if (loading) return <Spinner />;
  return (
    <>
      <PageTitle title="Bulk import" />
      <div className="card mb-4 space-y-3">
        <p className="text-sm text-slate-600">
          Upload an Excel (.xlsx) or CSV file with columns: <b>service, title, date, start_time, end_time</b> and optionally location,
          description, priority, agency, checklist (separate items with <code>;</code>). Service names must match exactly one of your
          services.
        </p>
        <button className="btn btn-secondary" onClick={() => downloadText("activities-template.csv", templateCsv())}>
          Download CSV template
        </button>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:font-semibold file:text-brand-700"
        />
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Your service names</summary>
          <ul className="mt-1 list-disc pl-5">
            {services?.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </details>
      </div>

      <ErrorNote message={error} />

      {result && (
        <div className="space-y-3">
          {result.errors.length > 0 && (
            <div className="card border-red-200 bg-red-50">
              <p className="mb-2 text-sm font-semibold text-red-700">{result.errors.length} row(s) have problems and will be skipped</p>
              <ul className="space-y-1 text-sm text-red-700">
                {result.errors.slice(0, 30).map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card">
            <p className="mb-2 text-sm font-semibold">{result.ok.length} activities ready to import</p>
            <ul className="max-h-80 space-y-1 overflow-auto text-sm">
              {result.ok.slice(0, 100).map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-1">
                  <span className="font-mono text-xs">
                    {r.activity_date} {r.start_time}–{r.end_time}
                  </span>
                  <span className="font-medium">{r.title}</span>
                  <span className="text-slate-500">· {r.service_name}</span>
                  <PriorityBadge priority={r.priority} />
                </li>
              ))}
            </ul>
            <button className="btn btn-primary mt-3 w-full" disabled={busy || result.ok.length === 0} onClick={doImport}>
              {busy ? "Importing..." : `Import ${result.ok.length} activities`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
