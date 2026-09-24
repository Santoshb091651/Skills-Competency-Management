import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Empty, Panel, RatingBadge, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Search = { q?: string; department?: string };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { q = '', department = '' } = await searchParams;

  const employees = await prisma.employee.findMany({
    where: {
      employmentStatus: 'ACTIVE',
      ...(department ? { department } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { employeeCode: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      department: true,
      designation: true,
      manager: { select: { fullName: true } },
      skills: {
        where: { status: 'ACTIVE' },
        select: { currentRating: true },
      },
    },
  });

  const departments = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE', department: { not: null } },
    distinct: ['department'],
    select: { department: true },
    orderBy: { department: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Employees</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {employees.length} {employees.length === 1 ? 'person' : 'people'}
          {department && ` in ${department}`}
          {q && ` matching “${q}”`}
        </p>
      </div>

      {/* A GET form keeps the filter state in the URL, so a filtered view is
          shareable and the back button behaves. */}
      <form method="get" className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, code or email"
          aria-label="Search employees"
          className="w-72 rounded border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
        />
        <select
          name="department"
          defaultValue={department}
          aria-label="Filter by department"
          className="rounded border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.department} value={d.department ?? ''}>
              {d.department}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)]"
        >
          Apply
        </button>
        {(q || department) && (
          <Link
            href="/employees"
            className="self-center text-sm text-[var(--color-primary)] hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      <Panel title="Directory">
        {employees.length === 0 ? (
          <Empty>No employees match. Try clearing the filters, or run the seed script.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Department</Th>
                <Th>Designation</Th>
                <Th>Manager</Th>
                <Th className="text-right">Skills</Th>
                <Th>Average</Th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const ratings = employee.skills.map((s) => s.currentRating);
                const average =
                  ratings.length > 0
                    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
                    : null;

                return (
                  <tr key={employee.id} className="hover:bg-[var(--color-panel)]">
                    <Td className="font-mono text-xs text-[var(--color-muted)]">
                      {employee.employeeCode}
                    </Td>
                    <Td>
                      <Link
                        href={`/employees/${employee.id}`}
                        className="font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        {employee.fullName}
                      </Link>
                    </Td>
                    <Td>{employee.department ?? '—'}</Td>
                    <Td className="text-[var(--color-muted)]">{employee.designation ?? '—'}</Td>
                    <Td className="text-[var(--color-muted)]">{employee.manager?.fullName ?? '—'}</Td>
                    <Td className="text-right">{ratings.length}</Td>
                    <Td>
                      {average === null ? (
                        <span className="text-sm text-[var(--color-muted)]">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <RatingBadge value={Math.round(average)} />
                          <span className="text-xs text-[var(--color-muted)]">
                            {average.toFixed(2)}
                          </span>
                        </span>
                      )}
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
