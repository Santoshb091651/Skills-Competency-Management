import { prisma } from '@/lib/db';

/**
 * Trend queries, implementing the as-of carry-forward rule.
 *
 * The rule: a rating at the end of a period is the most recent LIVE assessment
 * with an effective date on or before that period end. It is NOT an average of
 * the assessments that happen to fall inside the period.
 *
 * This matters because ratings are sparse — people are reassessed every few
 * months at best. Averaging within a bucket would show a gap in every period
 * where nobody happened to be reassessed, making a stable skill look like
 * missing data. Carrying the last known value forward is the only reading that
 * reflects reality.
 *
 * Three consequences fall out of the same query:
 *   - a skill rated once in 2025 still reports that rating in every later period
 *   - a period before the skill was acquired produces no row at all, so it is
 *     absent rather than zero (0 means "assessed as none", which is different)
 *   - correcting a historical rating reshapes every affected period, because
 *     superseded rows are excluded rather than the correction being appended
 *
 * The Power BI model expresses the same rule in DAX — see
 * powerbi/SkillsCompetency.SemanticModel, measure [Rating As Of]. If you change
 * the semantics here, change them there too or the two will disagree.
 */

export type Granularity = 'MONTH' | 'QUARTER' | 'HALF' | 'YEAR';

export const GRANULARITIES: Granularity[] = ['MONTH', 'QUARTER', 'HALF', 'YEAR'];

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  MONTH: 'Monthly',
  QUARTER: 'Quarterly',
  HALF: 'Half-yearly',
  YEAR: 'Yearly',
};

export function parseGranularity(value: string | undefined): Granularity {
  const upper = (value ?? '').toUpperCase();
  return (GRANULARITIES as string[]).includes(upper) ? (upper as Granularity) : 'MONTH';
}

/**
 * SQL that turns a month within the window into the end of the period that
 * month belongs to. Selected from this closed map by an already-validated key,
 * never built from user input.
 *
 * Postgres has date_trunc for month, quarter and year but no notion of a
 * half-year, so that one is spelled out.
 */
const PERIOD_END_SQL: Record<Granularity, string> = {
  MONTH: `(date_trunc('month', m)::date + interval '1 month' - interval '1 day')::date`,
  QUARTER: `(date_trunc('quarter', m)::date + interval '3 month' - interval '1 day')::date`,
  HALF: `(CASE WHEN extract(month from m) <= 6
               THEN make_date(extract(year from m)::int, 6, 30)
               ELSE make_date(extract(year from m)::int, 12, 31) END)`,
  YEAR: `make_date(extract(year from m)::int, 12, 31)`,
};

/**
 * Period ends across the window, with the current in-progress period anchored
 * to today rather than to a date in the future.
 */
function bucketsCte(granularity: Granularity, months: number): string {
  return `
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - interval '${months} month',
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      )::date AS m
    ),
    bucket AS (
      SELECT DISTINCT LEAST(${PERIOD_END_SQL[granularity]}, CURRENT_DATE) AS period_end
      FROM months
    )
  `;
}

/** The live rating for every employee-skill as at each period end. */
const AS_OF_CTE = `
  as_of AS (
    SELECT DISTINCT ON (b.period_end, a.employee_skill_id)
           b.period_end,
           a.employee_skill_id,
           es.employee_id,
           es.skill_id,
           a.rating
    FROM   bucket b
    JOIN   skill_assessment a ON a.effective_date <= b.period_end
    JOIN   employee_skill  es ON es.id = a.employee_skill_id
    WHERE  a.superseded_at IS NULL
      AND  a.status = 'ACTIVE'
      AND  es.status = 'ACTIVE'
    ORDER  BY b.period_end, a.employee_skill_id, a.effective_date DESC, a.created_at DESC
  )
`;

export type TrendPoint = {
  period: string;
  periodEnd: string;
  avgRating: number;
  skillsHeld: number;
  employees: number;
};

function labelFor(periodEnd: Date, granularity: Granularity): string {
  const date = new Date(periodEnd);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  switch (granularity) {
    case 'MONTH':
      return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    case 'QUARTER':
      return `Q${Math.floor(month / 3) + 1} ${String(year).slice(2)}`;
    case 'HALF':
      return `H${month <= 5 ? 1 : 2} ${String(year).slice(2)}`;
    case 'YEAR':
      return String(year);
  }
}

/** Organisation-wide average rating over time (FR-TRD-01 at org scope). */
export async function organisationTrend(
  granularity: Granularity,
  months = 24,
): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ period_end: Date; avg_rating: number; skills_held: bigint; employees: bigint }>
  >(`
    ${bucketsCte(granularity, months)},
    ${AS_OF_CTE}
    SELECT period_end,
           ROUND(AVG(rating)::numeric, 2)::float8 AS avg_rating,
           COUNT(*)                               AS skills_held,
           COUNT(DISTINCT employee_id)            AS employees
    FROM   as_of
    GROUP  BY period_end
    ORDER  BY period_end
  `);

  return rows.map((row) => ({
    period: labelFor(row.period_end, granularity),
    periodEnd: new Date(row.period_end).toISOString().slice(0, 10),
    avgRating: Number(row.avg_rating),
    skillsHeld: Number(row.skills_held),
    employees: Number(row.employees),
  }));
}

export type CategoryTrendPoint = { period: string } & Record<string, string | number>;

/** Average rating per skill category over time (FR-TRD-05). */
export async function categoryTrend(
  granularity: Granularity,
  months = 24,
): Promise<{ data: CategoryTrendPoint[]; categories: string[] }> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ period_end: Date; category: string; avg_rating: number }>
  >(`
    ${bucketsCte(granularity, months)},
    ${AS_OF_CTE}
    SELECT a.period_end,
           c.name                                   AS category,
           ROUND(AVG(a.rating)::numeric, 2)::float8 AS avg_rating
    FROM   as_of a
    JOIN   skill s          ON s.id = a.skill_id
    JOIN   skill_category c ON c.id = s.category_id
    GROUP  BY a.period_end, c.name, c.display_order
    ORDER  BY a.period_end, c.display_order
  `);

  const categories = [...new Set(rows.map((r) => r.category))];
  const byPeriod = new Map<string, CategoryTrendPoint>();

  for (const row of rows) {
    const key = new Date(row.period_end).toISOString();
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { period: labelFor(row.period_end, granularity) });
    }
    byPeriod.get(key)![row.category] = Number(row.avg_rating);
  }

  return { data: [...byPeriod.values()], categories };
}

export type DistributionPoint = { period: string } & Record<string, string | number>;

/** How many skills sit at each level, over time (FR-TRD-12). */
export async function distributionTrend(
  granularity: Granularity,
  months = 24,
): Promise<DistributionPoint[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ period_end: Date; rating: number; count: bigint }>
  >(`
    ${bucketsCte(granularity, months)},
    ${AS_OF_CTE}
    SELECT period_end, rating, COUNT(*) AS count
    FROM   as_of
    GROUP  BY period_end, rating
    ORDER  BY period_end, rating
  `);

  const byPeriod = new Map<string, DistributionPoint>();
  for (const row of rows) {
    const key = new Date(row.period_end).toISOString();
    if (!byPeriod.has(key)) {
      const empty: DistributionPoint = { period: labelFor(row.period_end, granularity) };
      for (let level = 0; level <= 5; level++) empty[`level${level}`] = 0;
      byPeriod.set(key, empty);
    }
    byPeriod.get(key)![`level${row.rating}`] = Number(row.count);
  }

  return [...byPeriod.values()];
}

/** One employee's average rating over time (FR-TRD-01). */
export async function employeeTrend(
  employeeId: string,
  granularity: Granularity,
  months = 24,
): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ period_end: Date; avg_rating: number; skills_held: bigint }>
  >(
    `
    ${bucketsCte(granularity, months)},
    ${AS_OF_CTE}
    SELECT period_end,
           ROUND(AVG(rating)::numeric, 2)::float8 AS avg_rating,
           COUNT(*)                               AS skills_held
    FROM   as_of
    WHERE  employee_id = $1::uuid
    GROUP  BY period_end
    ORDER  BY period_end
  `,
    employeeId,
  );

  return rows.map((row) => ({
    period: labelFor(row.period_end, granularity),
    periodEnd: new Date(row.period_end).toISOString().slice(0, 10),
    avgRating: Number(row.avg_rating),
    skillsHeld: Number(row.skills_held),
    employees: 1,
  }));
}

export type SkillSeriesPoint = { period: string } & Record<string, string | number>;

/**
 * One line per skill for a single employee (FR-TRD-02). Rendered as a step
 * chart, because a rating holds its value until the next assessment rather
 * than drifting between them.
 */
export async function employeeSkillTrend(
  employeeId: string,
  granularity: Granularity,
  months = 24,
  limit = 6,
): Promise<{ data: SkillSeriesPoint[]; skills: string[] }> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ period_end: Date; skill: string; rating: number }>
  >(
    `
    ${bucketsCte(granularity, months)},
    ${AS_OF_CTE}
    SELECT a.period_end, s.name AS skill, MAX(a.rating) AS rating
    FROM   as_of a
    JOIN   skill s ON s.id = a.skill_id
    WHERE  a.employee_id = $1::uuid
    GROUP  BY a.period_end, s.name
    ORDER  BY a.period_end
  `,
    employeeId,
  );

  // Show the skills that moved the most; a chart with twenty lines is unreadable.
  const spread = new Map<string, { min: number; max: number }>();
  for (const row of rows) {
    const current = spread.get(row.skill);
    if (!current) spread.set(row.skill, { min: row.rating, max: row.rating });
    else {
      current.min = Math.min(current.min, row.rating);
      current.max = Math.max(current.max, row.rating);
    }
  }

  const skills = [...spread.entries()]
    .sort((a, b) => b[1].max - b[1].min - (a[1].max - a[1].min))
    .slice(0, limit)
    .map(([name]) => name);

  const selected = new Set(skills);
  const byPeriod = new Map<string, SkillSeriesPoint>();

  for (const row of rows) {
    if (!selected.has(row.skill)) continue;
    const key = new Date(row.period_end).toISOString();
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { period: labelFor(row.period_end, granularity) });
    }
    byPeriod.get(key)![row.skill] = row.rating;
  }

  return { data: [...byPeriod.values()], skills };
}
