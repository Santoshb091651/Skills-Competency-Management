import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Card, Empty, Panel, RatingBadge, Td, Th, formatDate } from '@/components/ui';

export default async function DashboardPage() {
  // A fresh clone that has not been seeded should explain itself rather than
  // render a wall of zeroes.
  let stats;
  try {
    stats = await loadStats();
  } catch (error) {
    return (
      <Panel title="Cannot reach the database">
        <p className="text-sm">
          The app is running but could not query PostgreSQL. Check that the{' '}
          <code>db</code> container is up and that migrations have been applied.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-[var(--color-panel)] p-3 text-xs">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </Panel>
    );
  }

  const { employees, skills, assessments, avgRating, recent, topSkills } = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Skills, ratings and progression across the organisation.
        </p>
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
        <Card title="Average rating" value={avgRating === null ? '—' : avgRating.toFixed(2)} hint="across active skills" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Most widely held skills">
          {topSkills.length === 0 ? (
            <Empty>Nothing rated yet.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Skill</Th>
                  <Th>People</Th>
                  <Th>Average</Th>
                </tr>
              </thead>
              <tbody>
                {topSkills.map((row) => (
                  <tr key={row.skillId}>
                    <Td>
                      <Link href={`/skills`} className="text-[var(--color-primary)] hover:underline">
                        {row.name}
                      </Link>
                    </Td>
                    <Td>{row.people}</Td>
                    <Td>
                      <RatingBadge value={Math.round(row.avg)} />
                      <span className="ml-2 text-xs text-[var(--color-muted)]">
                        {row.avg.toFixed(2)}
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

async function loadStats() {
  const [employees, skills, assessments, ratingAgg] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
    prisma.skill.count({ where: { status: 'ACTIVE' } }),
    prisma.skillAssessment.count({ where: { supersededAt: null, status: 'ACTIVE' } }),
    prisma.employeeSkill.aggregate({
      where: { status: 'ACTIVE' },
      _avg: { currentRating: true },
    }),
  ]);

  const recentRows = await prisma.skillAssessment.findMany({
    where: { supersededAt: null, status: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }],
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

  // Top skills by how many people hold them. Grouping in the database keeps
  // this a single round trip regardless of catalog size.
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
