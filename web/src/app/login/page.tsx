"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth, homeFor } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase";
import { ErrorNote, Field } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const { loading, profile, signIn } = useAuth();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && profile) router.replace(homeFor(profile.role));
  }, [loading, profile, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(loginId, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fixed right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Maintenance Tracker</h1>
          <p className="mt-1 text-sm text-zinc-400">NSCBI Airport · Airports Authority of India</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          {!isConfigured && (
            <ErrorNote message="App is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." />
          )}
          <Field label="Login ID">
            <input
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <ErrorNote message={error} />
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <Link href="/guide/" className="btn btn-secondary mt-4 w-full">
          How to use this app
        </Link>
        <p className="mt-4 text-center text-xs text-slate-400">Forgot your password? Contact the system administrator.</p>
      </div>
    </div>
  );
}
