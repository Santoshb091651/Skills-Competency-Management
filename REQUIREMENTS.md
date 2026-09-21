# Employee Skills & Competency Management Dashboard — Requirements

**Status:** Draft v1.0 for review
**Owner:** Engineering Manager (requester)
**Companion document:** [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. Purpose

A web application that lets managers record, maintain, and analyse the technical
competency of their teams. Every skill an employee holds carries a rating from
**0 to 5**, is assigned to a **skill category**, and has a **complete, permanent
history** of how that rating changed over time — including who changed it, when,
and why.

The dashboard answers three questions:

1. **Where are we now?** — what skills does each employee hold, and at what level.
2. **How did we get here?** — the full audit trail of every rating that was ever
   recorded, corrected, or removed.
3. **Where are we heading?** — competency trends over month, quarter, half-year,
   and year, viewed either per employee or per skill.

---

## 2. Scope

### 2.1 In scope (v1)

- Employee master data loaded from an **Excel upload**.
- A governed **skill catalog** with categories, maintained in-app.
- A configurable **0–5 rating scale**, where each level carries a written description.
- Recording, editing, and correcting skill ratings, including **backdated entries**.
- An **immutable audit trail** of every change.
- **Trend analytics** at employee level and at skill level, over selectable periods.
- **Role-based access**: Admin and Manager can write; Employee can read.
- Sign-in through **Microsoft Entra ID** (Azure AD) single sign-on.

### 2.2 Out of scope (v1)

- Self-assessment by employees and manager approval workflows.
- Learning-management integration (course catalogs, certifications, LMS sync).
- Performance reviews, goal setting, and compensation.
- Automatic HRIS synchronisation (Workday, SuccessFactors) — Excel upload covers v1.
- Skill-based staffing, project allocation, or resource planning.
- Mobile native apps (the web UI is responsive, which is sufficient).

---

## 3. Users and roles

| Role | Who they are | Core intent |
|---|---|---|
| **Admin** | HR systems owner / competency framework owner | Governs the skill catalog, rating scale, user roles, and imports. Sees everything. |
| **Manager** | Team / engineering manager | Maintains skill ratings for their people and analyses team trends. |
| **Employee** | Any staff member | Views their own competency profile and history; browses the team directory read-only. |

### 3.1 Permission matrix

| Capability | Admin | Manager | Employee |
|---|:---:|:---:|:---:|
| Sign in to the application | Yes | Yes | Yes |
| View own profile, skills, history, trends | Yes | Yes | Yes |
| View other employees' profiles and skills (read-only directory) | Yes | Yes | Yes |
| View other employees' **audit history** | Yes | In scope only | No |
| Assign a skill to an employee | Yes | In scope only | No |
| Record or update a rating | Yes | In scope only | No |
| **Correct or void a historical record** | Yes | In scope only | No |
| Archive a skill from an employee's profile | Yes | In scope only | No |
| Add a new skill to the catalog | Yes | Yes | No |
| Rename, deprecate, or merge catalog skills | Yes | No | No |
| Create or reorder skill categories | Yes | No | No |
| Edit the 0–5 rating scale descriptions | Yes | No | No |
| Upload the employee Excel file | Yes | No | No |
| View employee-level and skill-level trends | Yes | Yes | Own + directory aggregates |
| View the global audit log | Yes | No | No |
| Export data to CSV/Excel | Yes | Yes | Own data only |
| Assign application roles to users | Yes | No | No |

> **"In scope only"** means the employees in that manager's reporting line —
> direct and indirect reports, derived from the `manager_email` column of the
> Excel import. An Admin can additionally grant a manager **org-wide write
> scope** where a team is managed outside the formal reporting hierarchy
> (see FR-SEC-04).

### 3.2 What an employee can and cannot see

| Data | Own profile | Other employees |
|---|---|---|
| Name, employee code, department, designation, manager | Visible | Visible |
| Skills and current ratings | Visible | Visible |
| Rating level descriptions | Visible | Visible |
| Rating history and progression chart | Visible | Not visible |
| Assessment notes / justification text | Visible | Not visible |
| Audit trail (who changed what, when, why) | Visible | Not visible |
| Personal data: email, joining date, location | Visible | Email only |

---

## 4. Domain concepts

| Term | Definition |
|---|---|
| **Skill** | A named competency in the catalog, e.g. `Playwright`, `C`, `Selenium`, `Java`. Belongs to exactly one category. |
| **Skill category** | A grouping of related skills, e.g. `Programming Languages`, `Test Automation`. Used for filtering, grouping, and radar/aggregate views. |
| **Rating** | An integer `0..5` describing proficiency. `0` is the lowest (no exposure), `5` the highest (expert). |
| **Rating level** | The definition of a rating value: a short label plus a written description of what that level means. Configurable by an Admin. |
| **Employee skill** | The link between an employee and a skill. Holds the *current* rating and the date the skill was first acquired. |
| **Assessment** | One observation of a rating at a point in time. An employee skill has an ordered timeline of assessments — this timeline **is** the progression. |
| **Effective date** | The date a rating is considered *true from*. Drives all trend charts. Can be backdated. |
| **Recorded date** | The wall-clock time a row was written to the database. Drives the audit trail. Never backdated. |
| **Correction** | A change to an assessment that already exists. The original is preserved; a new version supersedes it. |
| **Void** | Marking an assessment as entered in error so it no longer counts toward trends. The row is never deleted. |
| **Audit event** | An immutable record of any create, update, void, import, or configuration change made in the system. |

---

## 5. Functional requirements

Requirement IDs are stable and referenced by the architecture document and by
test cases. **M** = must have (v1), **S** = should have (v1 if time allows),
**C** = could have (v2).

### 5.1 Authentication and access control

| ID | Pri | Requirement |
|---|:--:|---|
| FR-SEC-01 | M | Users sign in with **Microsoft Entra ID** SSO (OpenID Connect). The application stores no passwords. |
| FR-SEC-02 | M | The application role (Admin / Manager / Employee) is derived from Entra **app roles** or **security group** membership, resolved at sign-in. |
| FR-SEC-03 | M | A signed-in user with no mapped role defaults to **Employee**. Users outside the tenant are rejected. |
| FR-SEC-04 | M | An Admin can override a user's role in-app and can grant a Manager **org-wide write scope**. Overrides are audited. |
| FR-SEC-05 | M | Every permission is enforced **server-side** on every request. Hiding a UI control is never the only protection. |
| FR-SEC-06 | M | A signed-in user is linked to their `Employee` record by matching the Entra email to the imported employee email. Unmatched users can still sign in but see no "My profile". |
| FR-SEC-07 | S | Sessions expire after 8 hours of inactivity; sign-out clears the session locally and redirects to the Entra sign-out endpoint. |

### 5.2 Employee directory and profile

| ID | Pri | Requirement |
|---|:--:|---|
| FR-EMP-01 | M | The directory lists all active employees with code, name, department, designation, manager, skill count, and average rating. |
| FR-EMP-02 | M | The directory supports free-text search (name, code, email) and filters by department, designation, manager, skill, skill category, and minimum rating. |
| FR-EMP-03 | M | The directory is sortable by name, department, skill count, and average rating, and is paginated. |
| FR-EMP-04 | M | An employee profile shows a header (name, code, email, department, designation, manager, joining date, status) and three tabs: **Skills**, **Trends**, **History**. |
| FR-EMP-05 | M | The Skills tab lists every active skill with its category, current rating (value + level label), the date first acquired, the date last assessed, and who assessed it. |
| FR-EMP-06 | M | The Skills tab can be grouped by category and filtered by category or rating range. |
| FR-EMP-07 | M | The profile shows summary metrics: total skills, average rating, count of skills per rating level, count of skills at level 4+, and skills added in the last 90 days. |
| FR-EMP-08 | S | A "My profile" shortcut takes the signed-in user directly to their own record. |
| FR-EMP-09 | S | Managers and Admins can export the profile (skills + current ratings + history) to CSV or Excel. |

### 5.3 Employee data import (Excel)

| ID | Pri | Requirement |
|---|:--:|---|
| FR-IMP-01 | M | An Admin can upload an `.xlsx` file of employee master data. This is the only source of employee records in v1. |
| FR-IMP-02 | M | The application provides a **downloadable template** with the expected columns and an example row. |
| FR-IMP-03 | M | Required columns: `employee_code`, `full_name`, `email`. Optional columns: `department`, `designation`, `manager_email`, `location`, `date_of_joining`, `employment_status`. Column order does not matter; header matching is case- and space-insensitive. |
| FR-IMP-04 | M | Upload runs as a **dry run first**. The user sees a preview listing rows to be created, rows to be updated (with a field-by-field before/after diff), unchanged rows, and errors — before anything is written. |
| FR-IMP-05 | M | The import is applied only after the user explicitly confirms the preview. |
| FR-IMP-06 | M | Records are matched on `employee_code`; if absent, on `email`. Matching rows are updated, new rows are inserted. Existing skills and history are never touched by an import. |
| FR-IMP-07 | M | Row-level validation: duplicate codes within the file, malformed email, unknown `manager_email`, invalid date format, and unknown `employment_status`. **Invalid rows are rejected individually** — valid rows still import. |
| FR-IMP-08 | M | Employees present in the database but absent from the file are **not deleted**. They may optionally be flagged `inactive` via an explicit toggle on the import screen. |
| FR-IMP-09 | M | Every import creates a batch record: file name, uploader, timestamp, counts (created / updated / unchanged / errors), and the per-row outcome. Batches are listed in an import history with a downloadable error report. |
| FR-IMP-10 | M | The manager hierarchy is resolved from `manager_email` after all rows are inserted, so a manager appearing later in the file still links correctly. Circular reporting lines are rejected with an error. |
| FR-IMP-11 | S | File size limit of 5 MB / 10,000 rows, with a clear error when exceeded. |

### 5.4 Skill catalog and categories

| ID | Pri | Requirement |
|---|:--:|---|
| FR-CAT-01 | M | Skills are organised into **skill categories**. Every skill belongs to exactly one category. |
| FR-CAT-02 | M | An Admin can create, rename, reorder, and deactivate categories. A category holding active skills cannot be deleted. |
| FR-CAT-03 | M | The system ships with a seeded catalog covering at minimum: Programming Languages (C, C++, Java, Python, JavaScript, TypeScript, C#, Go), Test Automation (Selenium, Playwright, Cypress, Appium, JUnit, TestNG, PyTest, Robot Framework), Frameworks & Libraries, Cloud & DevOps, Databases, Tools & Platforms, and Process & Methodology. |
| FR-CAT-04 | M | A **Manager or Admin can add a new skill** to the catalog: name, category, and optional description. The new skill is immediately available in the skill dropdown. |
| FR-CAT-05 | M | Skill names are **unique case-insensitively**. On entry, the system warns about near-duplicates (`playwright` vs `Playwright`, `JS` vs `JavaScript`) and offers the existing skill instead. |
| FR-CAT-06 | S | A skill can carry **aliases** (`JS` → `JavaScript`) that are searchable but do not create separate skills. |
| FR-CAT-07 | M | An Admin can **deprecate** a skill: it disappears from the "add skill" dropdown but remains visible on profiles and in history that already reference it. |
| FR-CAT-08 | S | An Admin can **merge** a duplicate skill into a target skill. All employee skills and assessments move to the target, with conflicts resolved by keeping the higher rating, and the merge is recorded as an audit event. |
| FR-CAT-09 | S | A skill detail page shows the definition, category, how many employees hold it, the rating distribution, and the skill-level trend. |
| FR-CAT-10 | C | An Admin can flag new manager-created skills as requiring approval before becoming generally selectable. |

### 5.5 Rating scale and rating descriptions

| ID | Pri | Requirement |
|---|:--:|---|
| FR-RAT-01 | M | Ratings are integers **0 to 5**. `0` is the lowest, `5` the highest. No other values are accepted. |
| FR-RAT-02 | M | Each rating level has a **short label** and a **written description** explaining what the level means. Both are shown wherever a rating is selected or displayed. |
| FR-RAT-03 | M | The default scale is: `0 None`, `1 Awareness`, `2 Novice`, `3 Practitioner`, `4 Advanced`, `5 Expert`. Default descriptions are: |
| | | **0 — None:** No practical exposure; has not worked with the skill. |
| | | **1 — Awareness:** Understands the core concepts and vocabulary; cannot yet deliver work unaided. |
| | | **2 — Novice:** Completes simple, well-defined tasks with guidance and review. |
| | | **3 — Practitioner:** Works independently on routine tasks and resolves common problems without help. |
| | | **4 — Advanced:** Handles complex or ambiguous work, reviews others' work, and sets local standards. |
| | | **5 — Expert:** Recognised authority; designs standards, mentors across teams, and solves novel problems. |
| FR-RAT-04 | M | An Admin can edit the label and description of each level. Values `0..5` themselves are fixed. |
| FR-RAT-05 | S | A category can override the level descriptions so that, for example, `Process & Methodology` reads differently from `Programming Languages`. Where no override exists, the global scale applies. |
| FR-RAT-06 | M | Separately from the scale, **every individual rating entry can carry a free-text note** — the justification, evidence, or context for that specific rating ("Led the Playwright migration for the regression suite"). |

### 5.6 Recording and maintaining ratings

| ID | Pri | Requirement |
|---|:--:|---|
| FR-SKL-01 | M | A Manager or Admin can **add a skill to an employee** by selecting the skill and an initial rating. |
| FR-SKL-02 | M | The skill selector is a **searchable dropdown**, grouped by category, showing the skill name and category. It excludes skills the employee already holds. |
| FR-SKL-03 | M | The rating selector is a **dropdown** listing all six levels as `value — label`, with the level description shown as helper text under the selection. |
| FR-SKL-04 | M | The add-skill dropdown includes an inline **"＋ Add new skill…"** action that opens the catalog form without leaving the page (FR-CAT-04). |
| FR-SKL-05 | M | Each rating entry captures: rating, **effective date** (defaults to today, may be backdated, may not be in the future), and an optional note (FR-RAT-06). |
| FR-SKL-06 | M | A Manager or Admin can **update the rating** of an existing employee skill. This appends a new assessment to the timeline; it does not overwrite the previous one. |
| FR-SKL-07 | M | A new assessment with the same effective date as an existing one supersedes it rather than creating two entries on the same day. The user is warned before this happens. |
| FR-SKL-08 | M | The employee skill's **current rating** always reflects the assessment with the latest effective date that is not superseded or voided. |
| FR-SKL-09 | M | The **date first acquired** is the effective date of the employee's earliest non-voided assessment for that skill, and is recalculated automatically after any correction. |
| FR-SKL-10 | M | A Manager or Admin can **archive** an employee skill (no longer relevant). Archived skills disappear from the active list and from current-state trends, but their history is preserved and viewable. |
| FR-SKL-11 | S | A Manager can set a **target rating** and target date per employee skill, and the profile shows the gap against the current rating. |
| FR-SKL-12 | S | Bulk entry: a Manager can rate one skill across several team members, or several skills for one employee, in a single screen. |
| FR-SKL-13 | M | Ratings can never be entered for an employee outside the acting manager's scope (FR-SEC-05). |

### 5.7 Corrections to historical records

| ID | Pri | Requirement |
|---|:--:|---|
| FR-HIS-01 | M | A Manager or Admin can **modify an existing historical assessment**: its rating, its effective date, or its note. |
| FR-HIS-02 | M | A correction **never overwrites** the original row. The original is retained and marked superseded; a new version is written carrying a link back to what it replaced. |
| FR-HIS-03 | M | A correction **requires a reason** (free text, minimum 10 characters). The save is blocked without it. |
| FR-HIS-04 | M | A Manager or Admin can **void** an assessment entered in error. A voided assessment is excluded from the current rating and from all trends, but remains visible in the history marked "voided", with its reason. |
| FR-HIS-05 | M | Nothing is ever hard-deleted. There is no user-facing operation that removes a rating record from the database. |
| FR-HIS-06 | M | After any correction or void, the current rating, the first-acquired date, and every affected trend are **recomputed automatically** from the corrected timeline. |
| FR-HIS-07 | M | The history view distinguishes the **effective date** (when the rating was true) from the **recorded date** (when it was entered), and shows both. |
| FR-HIS-08 | S | Correcting an assessment older than a configurable window (default 12 months) shows an extra confirmation warning that trend history will shift. |

### 5.8 Audit trail

| ID | Pri | Requirement |
|---|:--:|---|
| FR-AUD-01 | M | **Every** change is recorded as an audit event: employee created or updated, skill assigned, rating added, rating corrected, rating voided, skill archived, catalog change, rating-scale change, role change, and import committed. |
| FR-AUD-02 | M | Each audit event stores: timestamp, actor (user + role), action, entity type and ID, affected employee, before-state, after-state, and the reason where one was required. |
| FR-AUD-03 | M | Audit events are **append-only**. The application has no code path that updates or deletes them, and the database role used by the app is not granted `UPDATE`/`DELETE` on the audit table. |
| FR-AUD-04 | M | The employee profile **History** tab shows a reverse-chronological trail of every change to that employee's skills, with actor, dates, before → after values, and reason. |
| FR-AUD-05 | M | The history can be filtered by skill, by category, by actor, by action type, and by date range. |
| FR-AUD-06 | M | A single skill's history is viewable on its own — the full progression of `Playwright` for one employee, from first entry to today, including corrections. |
| FR-AUD-07 | M | An Admin can view a **global audit log** across all employees and configuration, with the same filters plus full-text search. |
| FR-AUD-08 | S | The audit log is exportable to CSV for a selected date range. |
| FR-AUD-09 | M | Audit records are retained indefinitely in v1. Any future purge policy must be an explicit, audited Admin action. |

### 5.9 Trends and analytics

| ID | Pri | Requirement |
|---|:--:|---|
| FR-TRD-01 | M | **Employee-level trend:** for one employee, a time series of their average rating across all active skills, with the count of skills held plotted alongside. |
| FR-TRD-02 | M | **Employee × skill trend:** for one employee, a line per selected skill showing how that specific rating moved over time (a step chart — a rating holds its value until the next assessment). |
| FR-TRD-03 | M | **Skill-level trend:** for one skill, a time series of the average rating across a population of employees, plus the number of employees holding the skill. |
| FR-TRD-04 | M | The skill-level population can be filtered by department, manager, designation, and location, so a manager can see "Playwright across my team" versus "Playwright across the org". |
| FR-TRD-05 | M | **Category trend:** average rating over time per skill category, for an employee or for a population. |
| FR-TRD-06 | M | Granularity is selectable: **Monthly, Quarterly, Half-yearly, Yearly**. |
| FR-TRD-07 | M | The time window is selectable: last 6 months, last 12 months, last 2 years, all time, or a custom from/to date range. |
| FR-TRD-08 | M | Trends are computed from **effective dates**, not recorded dates, so a backdated entry appears in the period it actually belongs to. |
| FR-TRD-09 | M | A rating **carries forward** between assessments: if an employee was rated 3 in March and 4 in September, April through August read 3, not "no data". Periods before the skill was first acquired are empty, not zero. |
| FR-TRD-10 | M | Voided and superseded assessments are excluded from every trend calculation. |
| FR-TRD-11 | M | Each chart shows the change versus the previous period (delta and direction) and supports hovering for exact values. |
| FR-TRD-12 | S | A **rating distribution** view: stacked bars showing how many employees sit at each level for a skill, over time. |
| FR-TRD-13 | S | A **skill coverage heatmap**: employees on one axis, skills on the other, cell colour by rating — used to spot single points of failure. |
| FR-TRD-14 | S | A **category radar** on the employee profile comparing the employee's per-category average against their team's average. |
| FR-TRD-15 | S | Every chart has a "view as table" toggle and a CSV export of the underlying series. |

### 5.10 Dashboard and reporting

| ID | Pri | Requirement |
|---|:--:|---|
| FR-DSH-01 | M | The landing dashboard shows headline metrics for the viewer's scope: employees tracked, skills tracked, total ratings recorded, overall average rating, and ratings updated in the last 30 days. |
| FR-DSH-02 | M | The dashboard shows the top skills by coverage, the weakest-covered skills, and the most recently updated profiles. |
| FR-DSH-03 | S | A **skill gap** panel lists skills where fewer than *N* people (configurable, default 2) are rated 3 or above. |
| FR-DSH-04 | S | A **staleness** panel lists employees or skills whose ratings have not been reviewed in more than *N* months (default 6). |
| FR-DSH-05 | S | A recent-activity feed of the latest rating changes, linking into the audit trail. |
| FR-DSH-06 | S | Exports: team skill matrix, per-employee history, and skill-level report, all to CSV/Excel. |

---

## 6. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | **Scale** | Designed for 2,000 employees, 300 catalog skills, ~100,000 employee-skill rows, and ~500,000 assessments, with 50 concurrent users. |
| NFR-02 | **Performance** | Directory and profile pages render in under 1.5 s p95. Trend queries return in under 1 s p95 for a 24-bucket series. Excel import of 2,000 rows completes in under 30 s. |
| NFR-03 | **Security** | All traffic over HTTPS. Authentication via Entra ID only. Authorisation enforced server-side per request. Protection against the OWASP Top 10, including parameterised queries, CSRF tokens on mutations, and strict output escaping. |
| NFR-04 | **Auditability** | The audit trail is append-only and complete: it must be possible to reconstruct any employee's skill state as at any past date from the audit data alone. |
| NFR-05 | **Data integrity** | Ratings are constrained to `0..5` at the database level. An employee cannot hold the same skill twice. Effective dates cannot be in the future. |
| NFR-06 | **Availability** | Single-instance deployment targeting 99% availability during business hours. Planned maintenance outside business hours. |
| NFR-07 | **Backup & recovery** | Nightly automated database backup, 30-day retention, with a documented and tested restore procedure. RPO 24 h, RTO 4 h. |
| NFR-08 | **Usability** | A manager can record a new skill rating in three clicks or fewer from the employee profile. All dropdowns support type-ahead search. |
| NFR-09 | **Accessibility** | WCAG 2.1 AA: full keyboard navigation, visible focus states, labelled form controls, and a data-table alternative for every chart. Rating is never communicated by colour alone. |
| NFR-10 | **Browser support** | Latest two versions of Chrome, Edge, Firefox, and Safari. Responsive down to tablet width. |
| NFR-11 | **Observability** | Structured JSON logs with a request ID, a `/api/health` endpoint, and error tracking with stack traces. Audit logging is separate from application logging. |
| NFR-12 | **Maintainability** | TypeScript strict mode, schema-validated API inputs, database migrations under version control, and no manual production schema edits. |
| NFR-13 | **Privacy** | The only personal data held is work contact and organisational data. No compensation, performance-review, or demographic data is stored. |
| NFR-14 | **Configurability** | Rating-scale text, categories, skills, staleness thresholds, and gap thresholds are configurable in-app without a code change. |
| NFR-15 | **Timezone** | Effective dates are stored as calendar dates with no timezone. Audit timestamps are stored in UTC and rendered in the viewer's local timezone. |

---

## 7. Key acceptance criteria

These cover the behaviours most likely to be implemented incorrectly.

**AC-1 — Adding a skill with a rating**
Given a manager viewing a report's profile, when they choose `Playwright` from the
skill dropdown and `3 — Practitioner` from the rating dropdown with today's date,
then the skill appears in the Skills tab at rating 3, the first-acquired date is
today, one assessment exists, and one audit event of type `ASSESSMENT_CREATED` is
recorded with the manager as actor.

**AC-2 — Progression is appended, not overwritten**
Given an employee rated 3 in `Java` effective 2026-03-15, when the manager records
4 effective 2026-09-20, then the current rating is 4, the history shows both
entries, and the employee × skill trend shows 3 from March through August and 4
from September.

**AC-3 — Correcting an old record**
Given an assessment of 3 effective 2026-03-15, when a manager corrects it to 2 with
the reason "rated against the wrong skill during onboarding", then the original
row still exists marked superseded, a new version exists with rating 2, the trend
for March through August now reads 2, the current rating recomputes accordingly,
and the audit trail shows `3 → 2` with actor, both timestamps, and the reason.

**AC-4 — Correction without a reason is rejected**
Given the correction dialog, when the reason field is empty or under 10 characters,
then the save button stays disabled and the API rejects the request with a 400.

**AC-5 — Voiding**
Given an assessment entered in error, when it is voided, then it is excluded from
the current rating and every trend, the first-acquired date recomputes, and it is
still listed in the history marked "voided" with its reason.

**AC-6 — Carry-forward in trends**
Given an employee with exactly one `Selenium` assessment of 4 effective 2025-11-10,
when the employee trend is viewed monthly for the last 12 months, then months
before November 2025 exclude Selenium entirely and every month from November 2025
onward includes it at 4.

**AC-7 — Granularity switching**
Given a skill-level trend over 24 months, when granularity changes from Monthly to
Quarterly, then the series returns 8 buckets, each bucket's value is the state as
at the last day of that quarter, and the current partial period is anchored to today.

**AC-8 — Excel dry run**
Given an upload of 100 rows where 3 have malformed emails, when the file is
uploaded, then nothing is written, the preview shows 97 valid rows split into
created/updated/unchanged plus 3 errors with row numbers and messages, and only
after confirmation are the 97 rows applied.

**AC-9 — Manager scope**
Given a manager whose reporting line does not include employee X, when they open
X's profile, then the skills are visible read-only, no edit controls are shown, the
History tab is hidden, and a direct API call to write a rating for X returns 403.

**AC-10 — Employee access**
Given an employee signed in, when they open their own profile, then skills, trends,
and full history are visible; when they open a colleague's profile, then skills and
current ratings are visible but trends, notes, and history are not; and every write
endpoint returns 403.

**AC-11 — Duplicate skill prevention**
Given `Playwright` already exists in the catalog, when a manager tries to add
`playwright`, then creation is blocked with a message offering the existing skill.

**AC-12 — Rating bounds**
Given any write path — UI, API, or import — when a rating outside `0..5` or a
non-integer is submitted, then it is rejected with a validation error and no row is
written.

---

## 8. Assumptions and constraints

1. Employee master data is authoritative in Excel and is re-uploaded whenever the
   organisation changes. The application is not the system of record for HR data.
2. The reporting hierarchy comes solely from `manager_email`. An employee has at
   most one manager.
3. All users are members of a single Microsoft Entra ID tenant.
4. Ratings are manager-assessed. There is no self-assessment or peer input in v1.
5. Skill ratings are updated on an ad-hoc or periodic-review cadence, not daily, so
   the trend engine must carry values forward between assessments.
6. The deployment is a single internal server. No multi-region or multi-tenant
   requirement.
7. English only. No localisation in v1.

---

## 9. Delivery phases

| Phase | Contents | Outcome |
|---|---|---|
| **Phase 1 — Foundation** | Entra SSO and RBAC, Excel import with dry-run preview, employee directory and profile, skill catalog with categories and seed data, configurable 0–5 rating scale. | Employees and the catalog exist; people can sign in and browse. |
| **Phase 2 — Ratings and history** | Add/update ratings via dropdowns with notes and effective dates, the assessment timeline, corrections and voids with mandatory reasons, per-employee and per-skill history views, the audit log. | The core record-keeping loop works end to end. |
| **Phase 3 — Trends** | The trend engine with carry-forward, employee-level and skill-level charts, all four granularities and window selection, category trends, delta indicators, chart-to-table toggle. | The analytical value lands. |
| **Phase 4 — Insight and polish** | Dashboard KPIs, gap and staleness panels, coverage heatmap, category radar, distribution bars, target ratings, bulk entry, CSV/Excel exports, skill merge. | Proactive management rather than record-keeping. |

---

## 10. Confirmed decisions

| Decision | Choice |
|---|---|
| Frontend + backend | Next.js (App Router, TypeScript) with Prisma |
| Database | PostgreSQL |
| Authentication | Microsoft Entra ID SSO; roles from app roles / security groups |
| Hosting | Docker Compose on an internal VM |
| Employee visibility | Own profile in full, plus a read-only directory of colleagues |
| Excel import scope | Employee master data only; skills and ratings are entered in the UI |
| Rating scale | Integer 0–5, 0 lowest, 5 highest, each level with an editable description |
| Deletion policy | Nothing is hard-deleted; corrections supersede and voids exclude |

> One adjustment to note: the intent was PostgreSQL in production with SQLite for
> local development. Prisma fixes the database provider in the schema file, so
> running two providers means maintaining two schemas and losing Postgres-specific
> features the trend engine relies on. Local development therefore uses
> **PostgreSQL in Docker**, which the chosen Docker Compose deployment already
> provides. Rationale is in [ARCHITECTURE.md](ARCHITECTURE.md) §3.

---

## 11. Open questions

| # | Question | Impact if unanswered |
|---|---|---|
| 1 | Should managers write only within their reporting line, or should any manager write for any employee? The design assumes reporting-line scope with an Admin-granted org-wide override. | Changes the authorisation rules only; both are supported. |
| 2 | Is there an existing competency framework whose level descriptions should replace the defaults in FR-RAT-03? | Descriptions are editable in-app, so this can change after launch. |
| 3 | How often will the employee Excel be re-uploaded — monthly, or on change? | Affects only whether a scheduled import reminder is worth building. |
| 4 | Should employees be notified when their rating changes (email or Teams)? | Currently out of scope; would be a Phase 4 addition. |
