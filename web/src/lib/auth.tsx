"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginIdToEmail, supabase } from "./supabase";
import type { Profile, Role } from "./types";

interface AuthState {
  loading: boolean;
  profile: Profile | null;
  signIn: (loginId: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  loading: true,
  profile: null,
  signIn: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase().from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data && !data.active) {
      await supabase().auth.signOut();
      setProfile(null);
    } else {
      setProfile((data as Profile) ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id));
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      // Defer to avoid deadlocks inside the auth callback.
      setTimeout(() => loadProfile(session?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (loginId: string, password: string) => {
    const { error } = await supabase().auth.signInWithPassword({
      email: loginIdToEmail(loginId),
      password,
    });
    return error ? "Invalid login id or password" : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(() => ({ loading, profile, signIn, signOut }), [loading, profile, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function homeFor(role: Role): string {
  switch (role) {
    case "se":
      return "/day/";
    case "me":
      return "/me/";
    case "gm":
      return "/gm/";
    default:
      return "/admin/";
  }
}
