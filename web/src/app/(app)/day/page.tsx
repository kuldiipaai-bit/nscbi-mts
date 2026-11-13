"use client";

import { DayActivities } from "@/components/DayActivities";
import { PageTitle } from "@/components/ui";

export default function DayPage() {
  return (
    <>
      <PageTitle title="Maintenance activities" />
      <DayActivities />
    </>
  );
}
