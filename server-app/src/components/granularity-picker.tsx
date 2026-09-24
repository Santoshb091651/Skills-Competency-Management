import Link from 'next/link';
import { GRANULARITIES, GRANULARITY_LABELS, type Granularity } from '@/lib/services/trends';

/**
 * Period switch (FR-TRD-06). Plain links rather than client state, so the
 * selection lives in the URL, survives a refresh and is shareable.
 */
export function GranularityPicker({
  current,
  basePath,
  extraParams = {},
}: {
  current: Granularity;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  return (
    <div className="inline-flex rounded border border-[var(--color-line)] bg-white p-0.5">
      {GRANULARITIES.map((granularity) => {
        const params = new URLSearchParams({ ...extraParams, granularity });
        const active = granularity === current;
        return (
          <Link
            key={granularity}
            href={`${basePath}?${params.toString()}`}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white'
                : 'rounded px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-panel)]'
            }
          >
            {GRANULARITY_LABELS[granularity]}
          </Link>
        );
      })}
    </div>
  );
}
