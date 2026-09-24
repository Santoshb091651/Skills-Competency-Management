import Link from 'next/link';
import { prisma } from '@/lib/db';
import {
  categoryTrend,
  distributionTrend,
  organisationTrend,
  parseGranularity,
} from '@/lib/services/trends';
import {
  AverageRatingTrend,
  CategoryTrend,
  DistributionTrend,
  SkillsHeldTrend,
} from '@/components/charts';
import { GranularityPicker } from '@/components/granularity-picker';
import { Card, Empty, Panel, RatingBadge, Td, Th, formatDate } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string }>;
}) {
  const granularity = parseGranularity((await searchParams).granularity);

  let data;
  try {
    data = await loadDashboard(granularity);
  } catch (error) {
    return (
      <Panel title="Cannot reach the database">
        <p className="text-sm">
          The app is running but could not query PostgreSQL. Check that the <code>db</code>{' '}
          container is up and that migrations have been applied.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-[var(--color-panel)] p-3 text-xs">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </Panel>
    );
  }

  const {
    employees,
    skills,
    assessments,
    avgRating,
    recent,
    topSkills,
    trend,
    categories,
    distribution,
    levelLabels,
  } = data;

  const latest = trend.at(-1);
  const previous = trend.at(-2);
  const delta =
    latest && previous ? Number((latest.avgRating - previous.avgRating).toFixed(2)) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Competency across the organisation, and how it is moving.
          </p>
        </div>
        <GranularityPicker current={granularity} basePath="/" />
      </div>

      {employees === 0 && (
        <Panel title="No data yet">
          <p className="text-sm">
            The schema is in place but nothing has been loaded. Run{' '}
            <code className="rounded bg-[var(--color-panel)] px-1.5 py-0.5">npm run db:seed</code>{' '}
            to populate demo employees, the skill catalog and two years of rating history.
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Employees" value={employees} />
        <Card title="Skills in catalog" value={skills} />
        <Card title="Ratings recorded" value={assessments} hint="live assessments only" />
        <Card
          title="Average rating"
          value={avgRating === null ? '—' : avgRating.toFixed(2)}
          hint={
            delta === null
              ? 'across active skills'
              : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs previous period`
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Average rating over time">
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Each point is the state as at the end of that period. A rating carries forward until
            the next assessment, so a flat line means stable, not missing.
          </p>
          <AverageRatingTrend data={trend} />
        </Panel>

        <Panel title="Skills held over time">
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Total employee-skill pairs in place at the end of each period. Growth here is the
            organisation acquiring capability, not ratings improving.
          </p>
          <SkillsHeldTrend data={trend} />
        </Panel>
      </div>

      <Panel title="Average rating by category">
        <p className="mb-2 text-xs text-[var(--color-muted)]">
          Where capability is deepening and where it is flat.
        </p>
        <CategoryTrend data={categories.data} categories={categories.categories} />
      </Panel>

      <Panel title="Rating distribution over time">
        <p className="mb-2 text-xs text-[var(--color-muted)]">
          How many skills sit at each level. A base that shifts upward is people progressing;
          a base that simply grows is new skills being added at low levels.
        </p>
        <DistributionTrend data={distribution} levelLabels={levelLabels} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Most widely held skills">
          {topSkills.length === 0 ? (
            <Empty>Nothing rated yet.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Skill</Th>
                  <Th className="text-right">People</Th>
                  <Th>Average</Th>
                </tr>
              </thead>
              <tbody>
                {topSkills.map((row) => (
                  <tr key={row.skillId}>
                    <Td>{row.name}</Td>
                    <Td className="text-right">{row.people}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <RatingBadge value={Math.round(row.avg)} />
                        <span className="text-xs text-[var(--color-muted)]">
                          {row.avg.toFixed(2)}
                        </span>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Recent rating activity">
          {recent.length === 0 ? (
            <Empty>No assessments recorded.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Skill</Th>
                  <Th>Rating</Th>
                  <Th>Effective</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link
                        href={`/employees/${row.employeeId}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {row.employeeName}
                      </Link>
                    </Td>
                    <Td>{row.skillName}</Td>
                    <Td>
                      <RatingBadge value={row.rating} />
                    </Td>
                    <Td className="text-[var(--color-muted)]">{formatDate(row.effectiveDate)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

async function loadDashboard(granularity: ReturnType<typeof parseGranularity>) {
  const [employees, skills, assessments, ratingAgg, levels] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
    prisma.skill.count({ where: { status: 'ACTIVE' } }),
    prisma.skillAssessment.count({ where: { supersededAt: null, status: 'ACTIVE' } }),
    prisma.employeeSkill.aggregate({ where: { status: 'ACTIVE' }, _avg: { currentRating: true } }),
    prisma.ratingLevel.findMany({
      where: { categoryId: null },
      orderBy: { value: 'asc' },
      select: { value: true, label: true },
    }),
  ]);

  const [trend, categories, distribution] = await Promise.all([
    organisationTrend(granularity),
    categoryTrend(granularity),
    distributionTrend(granularity),
  ]);

  const recentRows = await prisma.skillAssessment.findMany({
    where: { supersededAt: null, status: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }, { effectiveDate: 'desc' }],
    take: 8,
    select: {
      id: true,
      rating: true,
      effectiveDate: true,
      employeeSkill: {
        select: {
          employee: { select: { id: true, fullName: true } },
          skill: { select: { name: true } },
        },
      },
    },
  });

  const grouped = await prisma.employeeSkill.groupBy({
    by: ['skillId'],
    where: { status: 'ACTIVE' },
    _count: { _all: true },
    _avg: { currentRating: true },
    orderBy: { _count: { skillId: 'desc' } },
    take: 8,
  });

  const skillNames = await prisma.skill.findMany({
    where: { id: { in: grouped.map((g) => g.skillId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(skillNames.map((s) => [s.id, s.name]));

  return {
    employees,
    skills,
    assessments,
    avgRating: ratingAgg._avg.currentRating,
    trend,
    categories,
    distribution,
    levelLabels: Object.fromEntries(levels.map((l) => [l.value, l.label])) as Record<number, string>,
    recent: recentRows.map((row) => ({
      id: row.id,
      rating: row.rating,
      effectiveDate: row.effectiveDate,
      employeeId: row.employeeSkill.employee.id,
      employeeName: row.employeeSkill.employee.fullName,
      skillName: row.employeeSkill.skill.name,
    })),
    topSkills: grouped.map((g) => ({
      skillId: g.skillId,
      name: nameById.get(g.skillId) ?? 'Unknown',
      people: g._count._all,
      avg: g._avg.currentRating ?? 0,
    })),
  };
}
