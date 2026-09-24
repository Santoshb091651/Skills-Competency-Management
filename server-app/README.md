# Server-based application — parked prototype

The original custom web application for the Skills & Competency Dashboard,
before the solution was constrained to Power BI, Power Apps and Dataverse.

**This is kept for reference. It is not the delivery path**, and it is not
finished. See [`../powerplatform`](../powerplatform/README.md) and
[`../powerbi`](../powerbi/README.md) for the solution being built.

---

## Status: incomplete scaffold

Be clear on what this is before spending time on it.

| Layer | State |
|---|---|
| Database schema | **Complete.** Prisma schema plus two migrations, applied and verified against PostgreSQL 16. |
| Auth and authorisation | **Complete.** Entra ID config, role mapping, user provisioning, reporting-line scope resolution. |
| Supporting libraries | **Complete.** Typed environment access, Prisma client, structured logger, error contract. |
| HTTP routes | **Not started.** |
| User interface | **Not started.** There is no `src/app` directory. |
| Services layer | **Not started.** |
| Tests | **Not started.** |

Because Next.js requires `src/app`, **`npm run build` and `npm run dev` will
fail** on a fresh clone. That is expected. Work stopped when the platform
decision changed, roughly at the end of what the architecture called Phase 1.

---

## What is actually worth reading here

Two things survived the platform change as useful thinking, and both are worth
comparing against the Dataverse implementation.

### `prisma/schema.prisma`

The bi-temporal model in relational form. `SkillAssessment` separates
`effectiveDate` (when a rating became true, backdatable) from `createdAt` and
`supersededAt` (when the row was written and when it stopped being current).
Corrections insert a new row linked by `supersedesId` rather than overwriting.
This is the same model the Dataverse tables use, expressed in a language that
makes the constraints explicit.

### `prisma/migrations/20260921181724_hardening/migration.sql`

The rules a relational database can enforce that Dataverse cannot, which makes
it a useful checklist of what the Power Platform build has to enforce by other
means:

- rating bounds `0..5` as CHECK constraints on both tables
- `effective_date <= CURRENT_DATE`, so a rating can be backdated but never
  future-dated
- a correction or void must carry a reason of at least 10 characters
- emails stored lower-cased, enforced rather than assumed
- a partial index on live assessments only, which is the access path the
  as-of trend query depends on
- **`audit_event` made append-only with triggers** rather than with `REVOKE`,
  because the application may connect as the table owner and owner privileges
  cannot be revoked

That last one is the interesting comparison. The Power Platform build achieves
the same guarantee differently and arguably more strongly, by removing the
Delete privilege from every security role including Admin.

### `src/lib/auth/scope.ts`

The reporting-line closure as a recursive CTE. Dataverse replaces this entirely
with Manager hierarchy security — a native feature instead of a query — which is
one of the clearer wins from the platform move.

---

## Running it, if it is ever resumed

```powershell
npm install
docker compose up -d db          # PostgreSQL 16 on localhost:5432
copy .env.example .env           # then set AUTH_SECRET at minimum
npm run db:migrate
npm run db:seed                  # note: prisma/seed.ts was never written
```

`npm run dev` will fail until `src/app` exists. The first thing to build would
be `src/app/layout.tsx` and a page, then the service layer the architecture
describes.

Local development uses PostgreSQL in Docker rather than SQLite, because Prisma
pins the database provider in the schema and the trend query relies on
`DISTINCT ON` and `generate_series`, neither of which SQLite has.

### Stack

Next.js 16, React 19, TypeScript 7, Prisma 7 with the `@prisma/adapter-pg`
driver adapter, Auth.js v5 (beta) with the Microsoft Entra ID provider,
PostgreSQL 16, Tailwind 4.

Two version notes for anyone picking this up: Prisma 7 moved the connection URL
out of `schema.prisma` into `prisma7.config.ts` and now requires a driver
adapter, and `prisma` was pinned to 7.10.0 because its `latest` tag pointed at
an 8.0 release candidate.

---

## Known issues

- `npm audit` reports findings in the Prisma CLI's transitive dependencies
  (`deepmerge-ts`, `mysql2`) and in ExcelJS's `uuid@8`. None are reachable from
  application code, and no safe upgrade existed. The Dockerfile keeps the
  Prisma CLI in a separate `migrator` stage so it stays out of the runtime image.
- `prisma/seed.ts` is referenced by the `db:seed` script but was never written.
  The equivalent seed data now lives in
  [`../powerplatform/data`](../powerplatform/data) as CSV.
