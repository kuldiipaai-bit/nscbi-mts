import Link from "next/link";
import { GuideTour } from "@/components/GuideTour";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "How to use - Maintenance Tracker" };

// Public page (no sign-in needed): a short animated tour for each role.
export default function GuidePage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <div className="fixed right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">How to use Maintenance Tracker</h1>
        <p className="mt-1 text-sm text-zinc-400">Pick your role. Each tour takes about half a minute.</p>
        <Link href="/login/" className="mt-2 inline-block text-sm font-medium text-zinc-600 underline">
          Back to sign in
        </Link>
      </div>
      <GuideTour />
    </main>
  );
}
