"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, homeFor } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { Spinner } from "./ui";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: Record<Role, NavItem[]> = {
  se: [
    { href: "/day/", label: "Today", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" },
    { href: "/observations/", label: "Observations", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ],
  me: [
    { href: "/me/", label: "Schedule", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" },
    { href: "/me/new/", label: "Add", icon: "M12 4v16m8-8H4" },
    { href: "/me/import/", label: "Import", icon: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" },
    { href: "/me/recurring/", label: "Recurring", icon: "M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0019 13M18.4 9A8 8 0 005 11" },
    { href: "/observations/", label: "Observations", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ],
  gm: [
    { href: "/gm/", label: "Overview", icon: "M3 13h4v8H3zm7-6h4v14h-4zm7-4h4v18h-4z" },
    { href: "/day/", label: "Day view", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" },
    { href: "/observations/", label: "Observations", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ],
  admin: [
    { href: "/admin/", label: "Users", icon: "M17 20h5v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2c0-.7-.1-1.4-.4-2M7 20H2v-2a3 3 0 015.4-1.8M7 20v-2c0-.7.1-1.4.4-2m0 0a5 5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { href: "/admin/services/", label: "Services", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2" },
    { href: "/day/", label: "Day view", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" },
    { href: "/observations/", label: "Observations", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ],
};

/** Which roles may open which top-level section. */
const SECTION_ROLES: Record<string, Role[]> = {
  me: ["me", "admin"],
  gm: ["gm", "admin"],
  admin: ["admin"],
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!loading && !profile) router.replace("/login/");
  }, [loading, profile, router]);

  // Section guard (UI convenience; real enforcement is RLS in the database).
  useEffect(() => {
    if (!profile) return;
    const section = pathname.split("/").filter(Boolean)[0];
    const allowed = SECTION_ROLES[section];
    if (allowed && !allowed.includes(profile.role)) router.replace(homeFor(profile.role));
  }, [profile, pathname, router]);

  useEffect(() => {
    if (!profile) return;
    let stop = false;
    const tick = async () => {
      const { count } = await supabase()
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (!stop) setUnread(count ?? 0);
    };
    tick();
    const t = setInterval(tick, 30000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [profile, pathname]);

  if (loading || !profile) return <Spinner />;
  const nav = NAV[profile.role];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href={homeFor(profile.role)} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-900">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
            <span className="hidden sm:inline">Maintenance Tracker</span>
            <span className="sm:hidden">MTS</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/notifications/" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold">{profile.full_name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[profile.role]}</div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.replace("/login/");
              }}
              className="btn btn-secondary !min-h-[38px] !px-3"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ul className="mx-auto flex max-w-md justify-around rounded-2xl border border-zinc-200/80 bg-white/85 px-1 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          {nav.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href.replace(/\/$/, ""));
            const exact = nav.some((o) => o !== n && o.href.startsWith(n.href) && pathname.startsWith(o.href.replace(/\/$/, "")));
            const on = active && !exact;
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium transition ${on ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
                >
                  <Icon d={n.icon} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
