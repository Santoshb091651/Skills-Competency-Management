# Server-based application

The custom web application for the Skills & Competency Dashboard — Next.js,
Prisma and PostgreSQL.

It predates the decision to build on Power Apps, Power BI and Dataverse, so
**this is not the delivery path**. See [`../powerplatform`](../powerplatform/README.md)
and [`../powerbi`](../powerbi/README.md) for that. It is kept because it runs,
and because the data model in it is the clearest statement of how the
skills history actually works.

---

## Run it

One command, no configuration:

```bash
docker compose up --build -d
```

Then open **http://localhost:3000**.

The first build takes a few minutes. After that the stack starts in seconds.
It creates the database, applies both migrations, loads demo data — 12
employees, 50 skills and about 180 ratings with two years of history — and
serves the app.

To stop it:

```bash
docker compose down          # keep the data
docker compose down -v       # also delete the database volume
```

### Behind a corporate proxy

If the build fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, your network
inspects TLS and the container does not trust the intercepting CA. Copy your
organisation's root certificate into `docker/ca/` and rebuild — see
[`docker/ca/README.md`](docker/ca/README.md). This was needed on the machine
the app was developed on, so the mechanism is tested.

---

## What you will see

| Page | Contents |
|---|---|
| `/` | Headline counts, the most widely held skills, and recent rating activity. |
| `/employees` | Directory with search and a department filter. Filters live in the URL, so a filtered view is shareable. |
| `/employees/{id}` | Profile: current skills with ratings, and the **full history** — every rating ever recorded, including entries later corrected or voided. |
| `/skills` | Catalog by category, the 0–5 rating scale with its written definitions, and coverage per skill. Skills with fewer than two people at level 3+ are flagged. |
| `/api/health` | Liveness and database connectivity. Used by the container healthcheck. |

The history page is the one worth looking at. The seed deliberately includes
one **correction** and one **void** so the append-only model is visible rather
than merely described: the original row is still there, marked superseded or
struck through, with the reason it was changed.

---

## Developing against it

For hot reload, run the app on the host and only the database in Docker:

```bash
npm install
docker compose up -d db
cp .env.example .env          # Windows: copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript with no emit |
| `npm run db:migrate` | Apply migrations (development) |
| `npm run db:deploy` | Apply migrations (non-interactive, used by the container) |
| `npm run db:seed` | Load demo data — idempotent, safe to re-run |
| `npm run db:studio` | Prisma Studio, a table browser |
| `npm run db:reset` | Drop, re-migrate and re-seed |

### One trap worth knowing

`.env` holds `DATABASE_URL` pointing at **localhost**, which is right for
host-side commands but unreachable from inside a container. Docker Compose
automatically reads that same `.env` for variable substitution, so the compose
file deliberately reads `COMPOSE_DATABASE_URL` instead and never
`DATABASE_URL`. Renaming either one to "tidy it up" will break `docker compose up`
for anyone who has created a `.env`.

---

## Sign-in

The stack runs with `DEMO_MODE=true`, which bypasses single sign-on entirely and
signs everyone in as a fixed admin. An amber banner says so on every page.

For real authentication, remove `DEMO_MODE` and set the Entra ID variables in
`.env.example`. Roles come from Entra app roles or security groups, mapped in
`src/lib/auth/roles.ts`, and a manager's write scope is the transitive closure
of their reporting line, computed in `src/lib/auth/scope.ts`.

`DEMO_MODE` has to be set explicitly and is ignored outside it: forgetting to
set a flag locks you out, whereas forgetting to unset one would let anyone in.

---

## Status

Complete: the database schema and migrations, the auth and authorisation
layer, the read-side UI (dashboard, directory, profile with history, catalog),
the health endpoint, and the Docker deployment.

Not built: writing ratings through the UI, the Excel import, and the trend
charts. Data is entered by the seed script. Those three are the next pieces if
this were ever resumed — and all three exist in the Power Platform build.

---

## Why the schema is worth reading even though the app is parked

`prisma/schema.prisma` and the hardening migration encode rules the Power
Platform build has to enforce by other means, which makes them a useful
cross-check.

`SkillAssessment` separates **effective date** — when a rating became true,
backdatable — from **created at** and **superseded at**, which record when the
row was written and when it stopped being current. A correction never
overwrites: it inserts a new row linked by `supersedesId` and marks the
original superseded. That is why the history page can show both the corrected
timeline and what the system believed beforehand.

`prisma/migrations/20260921181724_hardening/migration.sql` adds what the schema
language cannot express: rating bounds of 0–5, `effective_date <= CURRENT_DATE`
so a rating can be backdated but never future-dated, a minimum-length reason on
corrections and voids, a partial index covering only live assessments, and an
**append-only audit table enforced with triggers** rather than `REVOKE` —
because the application may connect as the table owner, and owner privileges
cannot be revoked.

The Dataverse build reaches the same guarantee differently, and arguably more
strongly, by removing the Delete privilege from every security role including
Admin.

---

## Stack

Next.js 16, React 19, TypeScript 7, Prisma 7 with `@prisma/adapter-pg`,
Auth.js v5 (beta) with the Microsoft Entra ID provider, PostgreSQL 16,
Tailwind CSS 4.

Two notes for anyone picking this up. Prisma 7 moved the connection URL out of
`schema.prisma` into `prisma7.config.ts` and now requires a driver adapter.
`prisma` is pinned to 7.10.0 because its `latest` tag points at an 8.0 release
candidate.

`npm audit` reports findings in the Prisma CLI's transitive dependencies and in
ExcelJS's `uuid@8`. None are reachable from application code and no safe
upgrade existed; the Dockerfile keeps the Prisma CLI in a separate `migrator`
stage so it stays out of the long-running image.
