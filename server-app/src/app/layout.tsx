import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skills & Competency Dashboard',
  description: 'Employee skills, ratings, progression and audit history.',
};

// Every page reads live data, so nothing here should be statically rendered.
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/employees', label: 'Employees' },
  { href: '/skills', label: 'Skill catalog' },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Never let a database outage render a blank page; the banner below explains it.
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="bg-[var(--color-primary-dark)] text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Skills &amp; Competency
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-1.5 hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto text-right text-xs">
              {user ? (
                <>
                  <div className="font-semibold">{user.displayName}</div>
                  <div className="text-white/60">{user.role}</div>
                </>
              ) : (
                <span className="text-white/60">not signed in</span>
              )}
            </div>
          </div>
        </header>

        {env.isDemoMode && (
          <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-center text-xs text-amber-900">
            <strong>Demo mode.</strong> Single-sign-on is bypassed and everyone is
            signed in as a fixed user. Remove <code>DEMO_MODE</code> before any real deployment.
          </div>
        )}

        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>

        <footer className="mx-auto max-w-7xl px-6 pb-10 text-xs text-[var(--color-muted)]">
          Parked prototype — the delivered solution is built on Power Apps, Power BI and Dataverse.
        </footer>
      </body>
    </html>
  );
}
