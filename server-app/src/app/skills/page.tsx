import { prisma } from '@/lib/db';
import { Empty, Panel, RatingBadge, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SkillCatalogPage() {
  const categories = await prisma.skillCategory.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      skills: {
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          aliases: true,
          employeeSkills: {
            where: { status: 'ACTIVE' },
            select: { currentRating: true },
          },
        },
      },
    },
  });

  const levels = await prisma.ratingLevel.findMany({
    where: { categoryId: null },
    orderBy: { value: 'asc' },
    select: { value: true, label: true, description: true },
  });

  const totalSkills = categories.reduce((sum, c) => sum + c.skills.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Skill catalog</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {totalSkills} skills across {categories.length} categories.
        </p>
      </div>

      <Panel title="Rating scale">
        {levels.length === 0 ? (
          <Empty>The 0–5 scale has not been seeded.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th className="w-20">Value</Th>
                <Th className="w-40">Level</Th>
                <Th>What it means</Th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.value}>
                  <Td>
                    <RatingBadge value={level.value} />
                  </Td>
                  <Td className="font-semibold">{level.label}</Td>
                  <Td className="text-[var(--color-muted)]">{level.description}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {categories.length === 0 && (
        <Panel title="Catalog empty">
          <p className="text-sm">
            Run <code className="rounded bg-[var(--color-panel)] px-1.5 py-0.5">npm run db:seed</code>{' '}
            to load the categories and the starter skill catalog.
          </p>
        </Panel>
      )}

      {categories.map((category) => (
        <Panel key={category.id} title={category.name}>
          {category.description && (
            <p className="mb-3 text-xs text-[var(--color-muted)]">{category.description}</p>
          )}
          {category.skills.length === 0 ? (
            <Empty>No active skills in this category.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Skill</Th>
                  <Th>Also known as</Th>
                  <Th className="text-right">People</Th>
                  <Th>Average</Th>
                  <Th className="text-right">At 3+</Th>
                </tr>
              </thead>
              <tbody>
                {category.skills.map((skill) => {
                  const ratings = skill.employeeSkills.map((e) => e.currentRating);
                  const average =
                    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
                  const atThreePlus = ratings.filter((r) => r >= 3).length;

                  return (
                    <tr key={skill.id}>
                      <Td className="font-semibold">{skill.name}</Td>
                      <Td className="text-xs text-[var(--color-muted)]">
                        {skill.aliases.length > 0 ? skill.aliases.join(', ') : '—'}
                      </Td>
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
                      {/* Fewer than two people at 3+ is the skill-gap signal (FR-DSH-03). */}
                      <Td
                        className={`text-right ${
                          ratings.length > 0 && atThreePlus < 2
                            ? 'font-semibold text-[var(--color-crimson)]'
                            : ''
                        }`}
                      >
                        {atThreePlus}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      ))}
    </div>
  );
}
