"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, homeFor } from "@/lib/auth";
import { Spinner } from "@/components/ui";

export default function Index() {
  const { loading, profile } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(profile ? homeFor(profile.role) : "/login/");
  }, [loading, profile, router]);
  return <Spinner />;
}
