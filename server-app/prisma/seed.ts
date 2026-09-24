/**
 * Seeds the database so a fresh clone shows a working dashboard.
 *
 * Run: npm run db:seed
 *
 * Idempotent — everything upserts on a natural key, so re-running updates in
 * place rather than duplicating. Safe to run after every migration.
 *
 * Loads three things:
 *   1. The 0-5 rating scale and the skill catalog (the real configuration data)
 *   2. Demo employees with a reporting hierarchy
 *   3. Two years of rating history, including a correction and a void, so the
 *      append-only model is visible rather than merely described
 */

// tsx does not read .env the way the Prisma CLI does, so load it here. Harmless
// in Docker, where the variables are already in the environment.
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  AssessmentSource,
  AssessmentStatus,
  PrismaClient,
  Role,
} from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Configuration data
// ---------------------------------------------------------------------------

const RATING_LEVELS = [
  { value: 0, label: 'None', description: 'No practical exposure; has not worked with the skill.' },
  { value: 1, label: 'Awareness', description: 'Understands the core concepts and vocabulary; cannot yet deliver work unaided.' },
  { value: 2, label: 'Novice', description: 'Completes simple, well-defined tasks with guidance and review.' },
  { value: 3, label: 'Practitioner', description: 'Works independently on routine tasks and resolves common problems without help.' },
  { value: 4, label: 'Advanced', description: "Handles complex or ambiguous work, reviews others' work, and sets local standards." },
  { value: 5, label: 'Expert', description: 'Recognised authority; designs standards, mentors across teams, and solves novel problems.' },
];

const CATEGORIES = [
  { name: 'Programming Languages', order: 10, description: 'General-purpose languages used to build and script systems.' },
  { name: 'Test Automation', order: 20, description: 'Frameworks and tools for automated functional and non-functional testing.' },
  { name: 'Frameworks & Libraries', order: 30, description: 'Application frameworks and major libraries built on top of a language.' },
  { name: 'Cloud & DevOps', order: 40, description: 'Containers, orchestration, cloud platforms, CI/CD and observability.' },
  { name: 'Databases', order: 50, description: 'Relational and non-relational data stores and their query languages.' },
  { name: 'Tools & Platforms', order: 60, description: 'Day-to-day engineering tools and collaboration platforms.' },
  { name: 'Process & Methodology', order: 70, description: 'Ways of working, engineering practice and professional skills.' },
];

const SKILLS: Array<[string, string, string[]]> = [
  ['C', 'Programming Languages', []],
  ['C++', 'Programming Languages', ['CPP']],
  ['C#', 'Programming Languages', ['CSharp']],
  ['Java', 'Programming Languages', []],
  ['Python', 'Programming Languages', []],
  ['JavaScript', 'Programming Languages', ['JS']],
  ['TypeScript', 'Programming Languages', ['TS']],
  ['Go', 'Programming Languages', ['Golang']],
  ['SQL', 'Programming Languages', []],
  ['Shell Scripting', 'Programming Languages', ['Bash']],
  ['Selenium', 'Test Automation', ['Selenium WebDriver']],
  ['Playwright', 'Test Automation', []],
  ['Cypress', 'Test Automation', []],
  ['Appium', 'Test Automation', []],
  ['JUnit', 'Test Automation', []],
  ['TestNG', 'Test Automation', []],
  ['PyTest', 'Test Automation', []],
  ['Robot Framework', 'Test Automation', ['RF']],
  ['Cucumber', 'Test Automation', ['BDD']],
  ['JMeter', 'Test Automation', []],
  ['Spring Boot', 'Frameworks & Libraries', ['Spring']],
  ['ASP.NET Core', 'Frameworks & Libraries', ['.NET']],
  ['React', 'Frameworks & Libraries', []],
  ['Angular', 'Frameworks & Libraries', []],
  ['Node.js', 'Frameworks & Libraries', ['Node']],
  ['Django', 'Frameworks & Libraries', []],
  ['FastAPI', 'Frameworks & Libraries', []],
  ['Docker', 'Cloud & DevOps', []],
  ['Kubernetes', 'Cloud & DevOps', ['K8s']],
  ['Microsoft Azure', 'Cloud & DevOps', ['Azure']],
  ['Amazon Web Services', 'Cloud & DevOps', ['AWS']],
  ['Terraform', 'Cloud & DevOps', ['IaC']],
  ['Jenkins', 'Cloud & DevOps', []],
  ['GitHub Actions', 'Cloud & DevOps', ['GHA']],
  ['Grafana', 'Cloud & DevOps', []],
  ['PostgreSQL', 'Databases', ['Postgres']],
  ['Microsoft SQL Server', 'Databases', ['MSSQL']],
  ['Oracle Database', 'Databases', ['Oracle']],
  ['MongoDB', 'Databases', ['Mongo']],
  ['Redis', 'Databases', []],
  ['Git', 'Tools & Platforms', []],
  ['Jira', 'Tools & Platforms', []],
  ['Confluence', 'Tools & Platforms', []],
  ['Postman', 'Tools & Platforms', []],
  ['Power BI', 'Tools & Platforms', []],
  ['Agile / Scrum', 'Process & Methodology', ['Scrum']],
  ['Code Review', 'Process & Methodology', []],
  ['Test Strategy', 'Process & Methodology', []],
  ['CI/CD Practices', 'Process & Methodology', ['CICD']],
  ['Mentoring & Coaching', 'Process & Methodology', ['Mentoring']],
];

// ---------------------------------------------------------------------------
// Demo people
// ---------------------------------------------------------------------------

type DemoEmployee = {
  code: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  location: string;
  joined: string;
  managerEmail: string | null;
  skills: Array<[string, number]>;
};

const EMPLOYEES: DemoEmployee[] = [
  {
    code: 'E1001', name: 'Priya Raman', email: 'priya.raman@example.com',
    department: 'Quality Engineering', designation: 'Engineering Manager',
    location: 'Bengaluru', joined: '2018-03-12', managerEmail: null,
    skills: [['Test Strategy', 5], ['Agile / Scrum', 4], ['Selenium', 4], ['Mentoring & Coaching', 5], ['Jira', 4]],
  },
  {
    code: 'E1002', name: 'Daniel Okafor', email: 'daniel.okafor@example.com',
    department: 'Quality Engineering', designation: 'Senior Test Engineer',
    location: 'Bengaluru', joined: '2020-07-01', managerEmail: 'priya.raman@example.com',
    skills: [['Playwright', 4], ['TypeScript', 4], ['Selenium', 3], ['CI/CD Practices', 3], ['Git', 4], ['Code Review', 3]],
  },
  {
    code: 'E1003', name: 'Mei Lin Chen', email: 'meilin.chen@example.com',
    department: 'Quality Engineering', designation: 'Test Automation Engineer',
    location: 'Singapore', joined: '2022-01-17', managerEmail: 'priya.raman@example.com',
    skills: [['Playwright', 3], ['Python', 3], ['PyTest', 4], ['Docker', 2], ['Git', 3]],
  },
  {
    code: 'E1004', name: 'Tomas Novak', email: 'tomas.novak@example.com',
    department: 'Quality Engineering', designation: 'Test Engineer',
    location: 'Brno', joined: '2023-09-04', managerEmail: 'priya.raman@example.com',
    skills: [['Selenium', 2], ['Java', 2], ['TestNG', 2], ['Git', 2], ['Jira', 3]],
  },
  {
    code: 'E1005', name: 'Aisha Rahman', email: 'aisha.rahman@example.com',
    department: 'Platform Engineering', designation: 'Principal Engineer',
    location: 'Bengaluru', joined: '2016-06-20', managerEmail: null,
    skills: [['Kubernetes', 5], ['Go', 4], ['Terraform', 5], ['Microsoft Azure', 4], ['Docker', 5], ['Mentoring & Coaching', 4]],
  },
  {
    code: 'E1006', name: 'Lucas Ferreira', email: 'lucas.ferreira@example.com',
    department: 'Platform Engineering', designation: 'Senior Platform Engineer',
    location: 'Porto', joined: '2021-02-08', managerEmail: 'aisha.rahman@example.com',
    skills: [['Docker', 4], ['Kubernetes', 3], ['GitHub Actions', 4], ['Terraform', 3], ['PostgreSQL', 3], ['Grafana', 3]],
  },
  {
    code: 'E1007', name: 'Hannah Becker', email: 'hannah.becker@example.com',
    department: 'Platform Engineering', designation: 'Platform Engineer',
    location: 'Munich', joined: '2023-04-11', managerEmail: 'aisha.rahman@example.com',
    skills: [['Docker', 3], ['PostgreSQL', 2], ['Python', 3], ['Jenkins', 2]],
  },
  {
    code: 'E1008', name: 'Arjun Nair', email: 'arjun.nair@example.com',
    department: 'Application Development', designation: 'Engineering Manager',
    location: 'Kochi', joined: '2017-11-02', managerEmail: null,
    skills: [['Java', 4], ['Spring Boot', 4], ['Code Review', 4], ['Agile / Scrum', 4], ['Mentoring & Coaching', 3]],
  },
  {
    code: 'E1009', name: 'Sofia Rossi', email: 'sofia.rossi@example.com',
    department: 'Application Development', designation: 'Senior Software Engineer',
    location: 'Milan', joined: '2019-05-27', managerEmail: 'arjun.nair@example.com',
    skills: [['Java', 5], ['Spring Boot', 4], ['PostgreSQL', 4], ['React', 3], ['Git', 4], ['Code Review', 4]],
  },
  {
    code: 'E1010', name: 'Omar Haddad', email: 'omar.haddad@example.com',
    department: 'Application Development', designation: 'Software Engineer',
    location: 'Kochi', joined: '2022-08-15', managerEmail: 'arjun.nair@example.com',
    skills: [['TypeScript', 3], ['React', 3], ['Node.js', 3], ['Git', 3], ['MongoDB', 2]],
  },
  {
    code: 'E1011', name: 'Grace Mwangi', email: 'grace.mwangi@example.com',
    department: 'Data & Analytics', designation: 'Data Engineer',
    location: 'Nairobi', joined: '2021-10-04', managerEmail: 'arjun.nair@example.com',
    skills: [['Python', 4], ['SQL', 5], ['PostgreSQL', 4], ['Power BI', 3], ['Docker', 2]],
  },
  {
    code: 'E1012', name: 'Peter Lindqvist', email: 'peter.lindqvist@example.com',
    department: 'Data & Analytics', designation: 'Analytics Engineer',
    location: 'Stockholm', joined: '2024-02-19', managerEmail: 'arjun.nair@example.com',
    skills: [['SQL', 3], ['Power BI', 4], ['Python', 2]],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalize = (value: string) => value.trim().toLowerCase();
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function monthsAgo(months: number): Date {
  const now = new Date();
  const result = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 15));
  return result;
}

/** Stable hash, so the generated history is varied but identical on every run. */
function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
}

/**
 * Builds a plausible progression for one skill: the employee starts a level or
 * two below where they are now and improves in steps, so trend charts have a
 * shape instead of a flat line.
 *
 * The timing is staggered per employee-skill. Without that everyone improves on
 * the same dates, every line moves in lockstep, and the charts look synthetic —
 * which also hides the carry-forward behaviour they exist to demonstrate.
 */
function progressionFor(
  current: number,
  key: string,
): Array<{ rating: number; monthsAgo: number }> {
  const seed = hash(key);

  if (current <= 1) return [{ rating: current, monthsAgo: 6 + (seed % 10) }];

  // Some people arrive further along than others.
  const depth = current >= 4 ? 2 + (seed % 2) : 2;
  const start = Math.max(0, current - depth);

  // First assessment somewhere between 14 and 25 months ago.
  let offset = 14 + (seed % 12);
  const steps: Array<{ rating: number; monthsAgo: number }> = [];

  for (let rating = start; rating <= current; rating++) {
    steps.push({ rating, monthsAgo: offset });
    // Gaps of three to eight months between reassessments.
    const gap = 3 + ((seed >> (rating + 1)) % 6);
    offset = Math.max(1, offset - gap);
  }

  return steps;
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding...');

  // --- rating scale -------------------------------------------------------
  for (const level of RATING_LEVELS) {
    const existing = await prisma.ratingLevel.findFirst({
      where: { value: level.value, categoryId: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.ratingLevel.update({ where: { id: existing.id }, data: level });
    } else {
      await prisma.ratingLevel.create({ data: level });
    }
  }
  console.log(`  rating levels   ${RATING_LEVELS.length}`);

  // --- categories ---------------------------------------------------------
  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.skillCategory.upsert({
      where: { name: category.name },
      create: { name: category.name, description: category.description, displayOrder: category.order },
      update: { description: category.description, displayOrder: category.order, isActive: true },
      select: { id: true },
    });
    categoryIds.set(category.name, row.id);
  }
  console.log(`  categories      ${CATEGORIES.length}`);

  // --- skills -------------------------------------------------------------
  const skillIds = new Map<string, string>();
  for (const [name, categoryName, aliases] of SKILLS) {
    const categoryId = categoryIds.get(categoryName);
    if (!categoryId) throw new Error(`Unknown category '${categoryName}' for skill '${name}'`);

    const row = await prisma.skill.upsert({
      where: { normalizedName: normalize(name) },
      create: { name, normalizedName: normalize(name), categoryId, aliases },
      update: { name, categoryId, aliases },
      select: { id: true },
    });
    skillIds.set(name, row.id);
  }
  console.log(`  skills          ${SKILLS.length}`);

  // --- the assessing user -------------------------------------------------
  const assessor = await prisma.appUser.upsert({
    where: { email: 'dev.admin@example.com' },
    create: { email: 'dev.admin@example.com', displayName: 'Dev Admin', role: Role.ADMIN },
    update: { displayName: 'Dev Admin', role: Role.ADMIN },
    select: { id: true },
  });

  // --- employees ----------------------------------------------------------
  const employeeIds = new Map<string, string>();
  for (const person of EMPLOYEES) {
    const row = await prisma.employee.upsert({
      where: { employeeCode: person.code },
      create: {
        employeeCode: person.code,
        fullName: person.name,
        email: person.email.toLowerCase(),
        department: person.department,
        designation: person.designation,
        location: person.location,
        dateOfJoining: dateOnly(person.joined),
      },
      update: {
        fullName: person.name,
        department: person.department,
        designation: person.designation,
        location: person.location,
      },
      select: { id: true },
    });
    employeeIds.set(person.email, row.id);
  }

  // Managers are resolved in a second pass so someone listed later in the file
  // still links correctly — the same rule the Excel import follows (FR-IMP-10).
  for (const person of EMPLOYEES) {
    if (!person.managerEmail) continue;
    const managerId = employeeIds.get(person.managerEmail);
    if (!managerId) throw new Error(`Unknown manager '${person.managerEmail}' for ${person.code}`);
    await prisma.employee.update({
      where: { employeeCode: person.code },
      data: { managerId },
    });
  }
  console.log(`  employees       ${EMPLOYEES.length}`);

  // --- skills and their history ------------------------------------------
  let assessmentCount = 0;

  for (const person of EMPLOYEES) {
    const employeeId = employeeIds.get(person.email)!;

    for (const [skillName, currentRating] of person.skills) {
      const skillId = skillIds.get(skillName);
      if (!skillId) throw new Error(`Unknown skill '${skillName}' for ${person.code}`);

      const steps = progressionFor(currentRating, `${person.code}:${skillName}`);
      const firstAcquired = dateOnly(monthsAgo(steps[0]!.monthsAgo).toISOString().slice(0, 10));

      const employeeSkill = await prisma.employeeSkill.upsert({
        where: { employeeId_skillId: { employeeId, skillId } },
        create: {
          employeeId,
          skillId,
          currentRating,
          firstAcquiredOn: firstAcquired,
          lastAssessedOn: firstAcquired,
        },
        update: { currentRating },
        select: { id: true },
      });

      // Re-running should not stack duplicate history.
      const already = await prisma.skillAssessment.count({
        where: { employeeSkillId: employeeSkill.id },
      });
      if (already > 0) continue;

      let lastEffective = firstAcquired;
      let latestId: string | null = null;

      for (const step of steps) {
        const effectiveDate = dateOnly(monthsAgo(step.monthsAgo).toISOString().slice(0, 10));
        const created = await prisma.skillAssessment.create({
          data: {
            employeeSkillId: employeeSkill.id,
            rating: step.rating,
            effectiveDate,
            note:
              step.rating === currentRating
                ? `Assessed at ${step.rating} during the most recent review.`
                : `Progressed to ${step.rating}.`,
            assessedByUserId: assessor.id,
            source: AssessmentSource.MANUAL,
          },
          select: { id: true },
        });
        latestId = created.id;
        lastEffective = effectiveDate;
        assessmentCount++;
      }

      await prisma.employeeSkill.update({
        where: { id: employeeSkill.id },
        data: {
          currentAssessmentId: latestId,
          firstAcquiredOn: firstAcquired,
          lastAssessedOn: lastEffective,
        },
      });
    }
  }
  console.log(`  assessments     ${assessmentCount}`);

  await seedCorrectionAndVoid(assessor.id, employeeIds, skillIds);

  console.log('Done.');
}

/**
 * Creates one correction and one void, so the history view demonstrates the
 * append-only model rather than only describing it.
 */
async function seedCorrectionAndVoid(
  assessorId: string,
  employeeIds: Map<string, string>,
  skillIds: Map<string, string>,
) {
  // A correction: Daniel's early Selenium rating was too generous.
  const danielSelenium = await prisma.employeeSkill.findFirst({
    where: {
      employeeId: employeeIds.get('daniel.okafor@example.com'),
      skillId: skillIds.get('Selenium'),
    },
    select: { id: true },
  });

  if (danielSelenium) {
    const original = await prisma.skillAssessment.findFirst({
      where: { employeeSkillId: danielSelenium.id, supersededAt: null },
      orderBy: { effectiveDate: 'asc' },
      select: { id: true, rating: true, effectiveDate: true },
    });

    const alreadyCorrected = await prisma.skillAssessment.count({
      where: { employeeSkillId: danielSelenium.id, source: AssessmentSource.CORRECTION },
    });

    if (original && alreadyCorrected === 0 && original.rating > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.skillAssessment.update({
          where: { id: original.id },
          data: { supersededAt: new Date() },
        });
        await tx.skillAssessment.create({
          data: {
            employeeSkillId: danielSelenium.id,
            rating: original.rating - 1,
            effectiveDate: original.effectiveDate,
            supersedesId: original.id,
            source: AssessmentSource.CORRECTION,
            changeReason:
              'Original rating was recorded against the wrong framework during onboarding; corrected after review.',
            assessedByUserId: assessorId,
          },
        });
      });
      console.log('  correction      1');
    }
  }

  // A void: an entry added in error for Tomas.
  const tomasJira = await prisma.employeeSkill.findFirst({
    where: {
      employeeId: employeeIds.get('tomas.novak@example.com'),
      skillId: skillIds.get('Jira'),
    },
    select: { id: true },
  });

  if (tomasJira) {
    const alreadyVoided = await prisma.skillAssessment.count({
      where: { employeeSkillId: tomasJira.id, status: AssessmentStatus.VOIDED },
    });
    if (alreadyVoided === 0) {
      const target = await prisma.skillAssessment.findFirst({
        where: { employeeSkillId: tomasJira.id, supersededAt: null },
        orderBy: { effectiveDate: 'asc' },
        select: { id: true },
      });
      if (target) {
        await prisma.skillAssessment.update({
          where: { id: target.id },
          data: {
            status: AssessmentStatus.VOIDED,
            changeReason: 'Entered against the wrong employee during a bulk review session.',
          },
        });
        console.log('  void            1');
      }
    }
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
