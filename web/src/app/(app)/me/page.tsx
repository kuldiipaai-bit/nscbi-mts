"use client";

import { useEffect } from "react";
import { DayActivities } from "@/components/DayActivities";
import { PageTitle } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export default function MeHome() {
  // Keep recurring schedules materialised ~90 days ahead.
  useEffect(() => {
    supabase().rpc("extend_my_schedules", { p_days: 90 }).then(() => {});
  }, []);
  return (
    <>
      <PageTitle title="My services - schedule" />
      <DayActivities ownOnly />
    </>
  );
}
