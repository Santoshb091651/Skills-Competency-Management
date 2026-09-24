import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Card, Crumb, Empty, Panel, RatingBadge, Td, Th, formatDate } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      email: true,
      department: true,
      designation: true,
      location: true,
      dateOfJoining: true,
      manager: { select: { id: true, fullName: true } },
      skills: {
        where: { status: 'ACTIVE' },
        orderBy: [{ skill: { category: { displayOrder: 'asc' } } }, { skill: { name: 'asc' } }],
        select: {
          id: true,
          currentRating: true,
          firstAcquiredOn: true,
          lastAssessedOn: true,
          skill: {
            select: { name: true, category: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!employee) notFound();

  // The full timeline, including superseded and voided rows, so a correction is
  // visible as history rather than silently replacing what came before.
  const timeline = await prisma.skillAssessment.findMany({
    where: { employeeSkill: { employeeId: id } },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    take: 60,
    select: {
      id: true,
      rating: true,
      effectiveDate: true,
      createdAt: true,
      note: true,
      status: true,
      source: true,
      supersededAt: true,
      changeReason: true,
      employeeSkill: { select: { skill: { select: { name: true } } } },
      assessedBy: { select: { displayName: true } },
    },
  });

  const ratings = employee.skills.map((s) => s.currentRating);
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const atFourPlus = ratings.filter((r) => r >= 4).length;

  const levels = await prisma.ratingLevel.findMany({
    where: { categoryId: null },
    orderBy: { value: 'asc' },
    select: { value: true, label: true },
  });
  const labelFor = new Map(levels.map((l) => [l.value, l.label]));

  return (
    <div className="space-y-6">
      <Crumb href="/employees">← All employees</Crumb>

      <header className="rounded-lg border border-[var(--color-line)] bg-white p-5">
        <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">{employee.fullName}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
          <Field label="Code" value={employee.employeeCode} />
          <Field label="Email" value={employee.email} />
          <Field label="Department" value={employee.department} />
          <Field label="Designation" value={employee.designation} />
          <Field label="Location" value={employee.location} />
          <Field label="Joined" value={formatDate(employee.dateOfJoining)} />
          <Field label="Manager" value={employee.manager?.fullName} />
        </dl>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Skills held" value={employee.skills.length} />
        <Card title="Average rating" value={average === null ? '—' : average.toFixed(2)} />
        <Card title="At level 4+" value={atFourPlus} />
        <Card title="History entries" value={timeline.length} />
      </div>

      <Panel title="Skills">
        {employee.skills.length === 0 ? (
          <Empty>No skills recorded for this person yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Skill</Th>
                <Th>Category</Th>
                <Th>Rating</Th>
                <Th>First acquired</Th>
                <Th>Last assessed</Th>
              </tr>
            </thead>
            <tbody>
              {employee.skills.map((row) => (
                <tr key={row.id}>
                  <Td className="font-semibold">{row.skill.name}</Td>
                  <Td className="text-[var(--color-muted)]">{row.skill.category.name}</Td>
                  <Td>
                    <RatingBadge value={row.currentRating} label={labelFor.get(row.currentRating)} />
                  </Td>
                  <Td className="text-[var(--color-muted)]">{formatDate(row.firstAcquiredOn)}</Td>
                  <Td className="text-[var(--color-muted)]">{formatDate(row.lastAssessedOn)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="History">
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Every rating ever recorded, including entries that were later corrected or voided.
          Nothing is deleted. <strong>Effective</strong> is when the rating became true;{' '}
          <strong>recorded</strong> is when it was entered.
        </p>
        {timeline.length === 0 ? (
          <Empty>No history yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Skill</Th>
                <Th>Rating</Th>
                <Th>Effective</Th>
                <Th>Recorded</Th>
                <Th>By</Th>
                <Th>State</Th>
                <Th>Note / reason</Th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => {
                const superseded = row.supersededAt !== null;
                const voided = row.status === 'VOIDED';
                const live = !superseded && !voided;

                return (
                  <tr key={row.id} className={live ? '' : 'opacity-60'}>
                    <Td>{row.employeeSkill.skill.name}</Td>
                    <Td>
                      <span className={voided ? 'line-through' : ''}>
                        <RatingBadge value={row.rating} />
                      </span>
                    </Td>
                    <Td>{formatDate(row.effectiveDate)}</Td>
                    <Td className="text-[var(--color-muted)]">{formatDate(row.createdAt)}</Td>
                    <Td className="text-[var(--color-muted)]">{row.assessedBy?.displayName ?? '—'}</Td>
                    <Td>
                      {voided ? (
                        <Badge tone="crimson">voided</Badge>
                      ) : superseded ? (
                        <Badge tone="muted">superseded</Badge>
                      ) : row.source === 'CORRECTION' ? (
                        <Badge tone="amber">correction</Badge>
                      ) : (
                        <Badge tone="accent">live</Badge>
                      )}
                    </Td>
                    <Td className="max-w-md text-[var(--color-muted)]">
                      {row.changeReason ?? row.note ?? '—'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
      <dd className="font-medium">{value ?? '—'}</dd>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'accent' | 'amber' | 'crimson' | 'muted';
  children: React.ReactNode;
}) {
  const tones = {
    accent: 'bg-[#d6f0ec] text-[#0d6b62]',
    amber: 'bg-[#f8e5c8] text-[#8a4d05]',
    crimson: 'bg-[#f7dde0] text-[#8f2331]',
    muted: 'bg-[var(--color-panel-2)] text-[var(--color-muted)]',
  } as const;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
  );
}
