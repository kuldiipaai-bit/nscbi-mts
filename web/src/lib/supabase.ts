import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Single shared browser client. Only the URL/anon key differ between cloud and self-hosted. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing-anon-key",
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}

/** Engineers log in with their employee/login id; internally it maps to a synthetic email. */
export const LOGIN_DOMAIN = "mts.local";
export function loginIdToEmail(id: string): string {
  const v = id.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${LOGIN_DOMAIN}`;
}

export const PHOTO_BUCKET = "observation-photos";
