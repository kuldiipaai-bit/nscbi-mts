"use client";

import Link from "next/link";
import { Empty, ErrorNote, PageTitle, Spinner } from "@/components/ui";
import { useLoad } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/time";
import type { NotificationRow } from "@/lib/types";

export default function NotificationsPage() {
  const { data, loading, error, reload } = useLoad<NotificationRow[]>(async () => {
    const { data, error } = await supabase()
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRow[];
  }, []);

  async function markAll() {
    await supabase().from("notifications").update({ read: true }).eq("read", false);
    reload();
  }

  return (
    <>
      <PageTitle
        title="Notifications"
        action={
          <button className="btn btn-secondary" onClick={markAll}>
            Mark all read
          </button>
        }
      />
      <ErrorNote message={error} />
      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <Empty>You&apos;re all caught up.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id}>
              <Link
                href={n.observation_id ? `/observation/?id=${n.observation_id}` : "#"}
                className={`card block ${n.read ? "opacity-70" : "border-l-4 border-l-brand-500"}`}
              >
                <p className="text-sm font-medium">{n.message}</p>
                <p className="text-xs text-slate-500">{fmtDateTime(n.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
