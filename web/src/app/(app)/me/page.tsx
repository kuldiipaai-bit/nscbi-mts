"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DayActivities } from "@/components/DayActivities";
import { PageTitle } from "@/components/ui";
import { todayISO } from "@/lib/time";
import { supabase } from "@/lib/supabase";

export default function MeHome() {
  // Keep recurring schedules materialised ~90 days ahead.
  useEffect(() => {
    supabase().rpc("extend_my_schedules", { p_days: 90 }).then(() => {});
  }, []);
  return (
    <>
      <PageTitle
        title="My services - schedule"
        action={
          <Link href={`/report/?from=${todayISO()}&to=${todayISO()}`} className="btn btn-secondary">
            Print report
          </Link>
        }
      />
      <DayActivities ownOnly />
    </>
  );
}
