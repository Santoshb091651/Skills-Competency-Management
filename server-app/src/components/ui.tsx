import Link from 'next/link';

export function RatingBadge({ value, label }: { value: number | null; label?: string | null }) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-[var(--color-muted)]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`rating-badge rating-${value}`}>{value}</span>
      {label && <span className="text-sm text-[var(--color-muted)]">{label}</span>}
    </span>
  );
}

export function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </div>
      <div className="mt-1 text-3xl font-bold text-[var(--color-primary-dark)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
        <h2 className="text-sm font-bold text-[var(--color-primary-dark)]">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-[var(--color-line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-[var(--color-panel-2)] px-3 py-2 text-sm ${className}`}>{children}</td>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-[var(--color-muted)]">{children}</p>;
}

export function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-[var(--color-primary)] hover:underline">
      {children}
    </Link>
  );
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
