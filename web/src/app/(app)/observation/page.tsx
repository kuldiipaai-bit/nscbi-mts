"use client";

import { ObservationDetail } from "@/components/ObservationDetail";
import { PageTitle, Spinner } from "@/components/ui";
import { useQueryParam } from "@/lib/hooks";

export default function ObservationPage() {
  const id = useQueryParam("id");
  if (!id) return <Spinner />;
  return (
    <>
      <PageTitle title="Observation" />
      <ObservationDetail id={id} />
    </>
  );
}
