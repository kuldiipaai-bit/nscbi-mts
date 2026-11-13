"use client";

import { useAuth } from "./auth";
import { useLoad } from "./hooks";
import { supabase } from "./supabase";
import type { Service } from "./types";

/** Services the current user may schedule for: own services (ME) or all (Admin). */
export function useMyServices() {
  const { profile } = useAuth();
  return useLoad<Service[]>(async () => {
    if (!profile) return [];
    let q = supabase().from("services").select("*").eq("active", true).order("name");
    if (profile.role === "me") q = q.eq("owner_me_id", profile.id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Service[];
  }, [profile?.id]);
}
