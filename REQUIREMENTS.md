# Employee Skills & Competency Management Dashboard — Requirements

**Status:** Draft v2.0 for review — **Microsoft Power Platform edition**
**Owner:** Engineering Manager (requester)
**Companion document:** [ARCHITECTURE.md](ARCHITECTURE.md)

> **v2.0 change:** the solution is now constrained to **Power BI, Power Apps and
> Dataverse only**. The functional requirements are largely unchanged — they were
> written to be platform-neutral — but the access model, the import mechanism,
> the audit mechanism, and the non-functional requirements have been rewritten
> around the platform. Changes from v1.0 are marked **[v2]**.
>
> The custom Next.js/PostgreSQL prototype in this folder is **parked, not
> deleted**. It is no longer the target architecture.

---

## 1. Purpose

A Power Platform solution that lets managers record, maintain, and analyse the
technical competency of their teams. Every skill an employee holds carries a
rating from **0 to 5**, belongs to a **skill category**, and has a **complete,
permanent history** of how that rating changed over time — including who changed
it, when, and why.

The solution answers three questions:

1. **Where are we now?** — what skills each employee holds, and at what level.
2. **How did we get here?** — the full audit trail of every rating ever recorded,
   corrected, or removed.
3. **Where are we heading?** — competency trends over month, quarter, half-year,
   and year, viewed per employee or per skill.

---

## 2. Platform constraint **[v2]**

| # | Constraint | Consequence |
|---|---|---|
| PC-1 | The solution must be built with **Power BI, Power Apps, and Dataverse only**. | No custom web application, no custom API, no self-hosted database or servers. |
| PC-2 | **Dataverse** is the single system of record for all skills data. | Tables, relationships, choices, business rules, and security roles are defined in a Dataverse solution. |
| PC-3 | **Power Apps** delivers all data entry and record management. | A model-driven app is the primary interface; canvas screens are used where the model-driven form is too slow for the task. |
| PC-4 | **Power BI** delivers all trend and analytical reporting. | Every chart in section 5.9 is a Power BI visual, not an app control. |
| PC-5 | No pro-code extensions (plugins, custom connectors, Azure Functions, PCF components) unless explicitly approved. | Some behaviours that a custom app would enforce in code must instead be enforced by security configuration plus auditing. See FR-AUD-03 and open question 1. |
| PC-6 | **Power Automate is not assumed.** It is part of the Power Platform but was not named in the constraint. | Where a flow would materially improve the design, it is flagged rather than used. See open question 1. |
| PC-7 | Everything ships as a **managed Dataverse solution** promoted through Dev → Test → Prod environments. | No manual configuration directly in production. |

---

## 3. Users and roles

| Role | Who they are | Core intent | Dataverse security role **[v2]** |
|---|---|---|---|
| **Admin** | HR systems owner / competency framework owner | Governs the skill catalog, rating scale, imports, and role assignment. Sees everything. | `Skills Admin` |
| **Manager** | Team / engineering manager | Maintains skill ratings for their people and analyses team trends. | `Skills Manager` |
| **Employee** | Any staff member | Views their own competency profile and history; browses the team directory read-only. | `Skills Viewer` |

### 3.1 Permission matrix

| Capability | Admin | Manager | Employee |
|---|:---:|:---:|:---:|
| Sign in (Entra ID, native to the platform) | Yes | Yes | Yes |
| View own profile, skills, history, trends | Yes | Yes | Yes |
| View other employees' profiles and current ratings | Yes | Yes | Yes |
| View other employees' **rating history and notes** | Yes | In scope only | No |
| Assign a skill to an employee | Yes | In scope only | No |
| Record or update a rating | Yes | In scope only | No |
| **Correct or void a historical record** | Yes | In scope only | No |
| Archive a skill from an employee's profile | Yes | In scope only | No |
| Add a new skill to the catalog | Yes | Yes | No |
| Rename, deprecate, or merge catalog skills | Yes | No | No |
| Create or reorder skill categories | Yes | No | No |
| Edit the 0–5 rating scale descriptions | Yes | No | No |
| Import the employee Excel file | Yes | No | No |
| View employee-level and skill-level trends in Power BI | Yes | Yes | Own + aggregates |
| View the Dataverse audit history of any record | Yes | In scope only | No |
| Export to Excel / CSV | Yes | Yes | Own data only |
| Assign Dataverse security roles | Yes | No | No |

> **"In scope only"** means the employees in that manager's reporting line —
> direct and indirect. **[v2]** This is delivered by **Dataverse Manager
> hierarchy security** rather than application code: skill records are owned by
> the employee's manager, and the hierarchy grants roll-up access to managers
> further up the chain. An Admin can grant an individual manager organisation-wide
> write access by assigning an additional role (FR-SEC-04).

### 3.2 What an employee can and cannot see

| Data | Own profile | Other employees |
|---|---|---|
| Name, employee code, department, designation, manager | Visible | Visible |
| Skills and current ratings | Visible | Visible |
| Rating level labels and descriptions | Visible | Visible |
| Rating history and progression chart | Visible | Not visible |
| Assessment notes / justification text | **See open question 2** | Not visible |
| Record audit history | Not visible | Not visible |
| Personal data: email, joining date, location | Visible | Email only |

---

## 4. Domain concepts

| Term | Definition |
|---|---|
| **Skill** | A named competency in the catalog, e.g. `Playwright`, `C`, `Selenium`, `Java`. Belongs to exactly one category. |
| **Skill category** | A grouping of related skills, e.g. `Programming Languages`, `Test Automation`. Used for filtering, grouping, and category-level analysis. |
| **Rating** | A whole number `0..5` describing proficiency. `0` is the lowest, `5` the highest. |
| **Rating level** | The definition of a rating value: a short label plus a written description. Configurable by an Admin. |
| **Employee skill** | The link between an employee and a skill. Holds the *current* rating and the date the skill was first acquired. |
| **Assessment** | One observation of a rating at a point in time. The ordered set of assessments for an employee skill **is** the progression. |
| **Effective date** | The date a rating is considered *true from*. Drives all Power BI trends. May be backdated. |
| **Created on** | The Dataverse system timestamp for when the row was written. Drives the audit view. Never backdated. |
| **Correction** | A change to an assessment that already exists. The original is preserved and marked superseded; a new row replaces it. |
| **Void** | Marking an assessment as entered in error so it no longer counts toward the current rating or trends. The row is never deleted. |
| **Audit history** | Dataverse's native, tamper-evident record of every create, update, and delete, surfaced on each record's Audit History tab. |

---

## 5. Functional requirements

Requirement IDs are stable across v1.0 and v2.0 and are referenced by the
architecture document. **M** = must have, **S** = should have, **C** = could have.

### 5.1 Authentication and access control

| ID | Pri | Requirement |
|---|:--:|---|
| FR-SEC-01 | M | Users sign in with their **Microsoft Entra ID** work account. This is native to Power Apps and Power BI; no separate sign-in is built. |
| FR-SEC-02 | M | **[v2]** Application access is granted by **Dataverse security role** (`Skills Admin`, `Skills Manager`, `Skills Viewer`), assigned to Entra **security groups** rather than to individuals, so joiners and leavers are handled by existing identity processes. |
| FR-SEC-03 | M | A user with no assigned role cannot open the app. Users granted only `Skills Viewer` get read-only access. |
| FR-SEC-04 | M | **[v2]** An Admin can grant a manager organisation-wide write access by assigning a supplementary `Skills Manager (Org-wide)` role. Role assignment is captured by Dataverse auditing. |
| FR-SEC-05 | M | **[v2]** All permissions are enforced by the **Dataverse security model** (role privileges, ownership, hierarchy security, column security), not by hiding controls in the app. The same restrictions therefore apply to Excel exports, the Dataverse API, and Power BI. |
| FR-SEC-06 | M | **[v2]** The `Employee` row is linked to the person's Dataverse **User** record where one exists, which is what makes "My profile" and Power BI row-level security work. |
| FR-SEC-07 | S | Session lifetime and MFA follow the tenant's existing Entra ID conditional access policy. The solution defines no separate session rules. |

### 5.2 Employee directory and profile

| ID | Pri | Requirement |
|---|:--:|---|
| FR-EMP-01 | M | A directory view lists all active employees with code, name, department, designation, manager, skill count, and average rating. |
| FR-EMP-02 | M | The directory supports keyword search and filtering by department, designation, manager, skill, skill category, and minimum rating. |
| FR-EMP-03 | M | The directory is sortable by any listed column and pages through large result sets. |
| FR-EMP-04 | M | **[v2]** The employee form shows a header (name, code, email, department, designation, manager, joining date, status) and tabs for **Skills**, **Trends** (embedded Power BI), and **History**. |
| FR-EMP-05 | M | The Skills tab lists every active skill with category, current rating (value + level label), date first acquired, date last assessed, and who assessed it. |
| FR-EMP-06 | M | The Skills tab can be grouped by category and filtered by category or rating range. |
| FR-EMP-07 | M | The profile shows summary metrics: total skills, average rating, count of skills per rating level, skills at level 4+, and skills added in the last 90 days. |
| FR-EMP-08 | S | A "My profile" entry point opens the signed-in user's own record directly. |
| FR-EMP-09 | S | **[v2]** Managers and Admins can export any view to Excel using the platform's built-in export, which respects the same security as the app. |

### 5.3 Employee data import (Excel) **[v2 — mechanism changed]**

| ID | Pri | Requirement |
|---|:--:|---|
| FR-IMP-01 | M | An Admin can load employee master data from an `.xlsx` file. This remains the only source of employee records. |
| FR-IMP-02 | M | **[v2]** The import uses the **Dataverse "Import from Excel" data import wizard** inside the model-driven app, driven by a **published import template** with a saved column map so the Admin does not re-map columns each time. |
| FR-IMP-03 | M | Required columns: `employee_code`, `full_name`, `email`. Optional: `department`, `designation`, `manager_email`, `location`, `date_of_joining`, `employment_status`. |
| FR-IMP-04 | M | **[v2]** Imports run into a **staging table** first. The Admin reviews a validation summary — rows to create, rows to update with a field-level comparison, unchanged rows, and errors — before promoting the batch. Nothing reaches the live `Employee` table until promotion. |
| FR-IMP-05 | M | Promotion of a reviewed batch is an explicit, single action and is fully audited. |
| FR-IMP-06 | M | Records match on `employee_code`, falling back to `email`. **[v2]** `employee_code` is configured as an **alternate key** on the `Employee` table so Dataverse performs a true upsert. Existing skills and rating history are never touched by an import. |
| FR-IMP-07 | M | Row-level validation covers duplicate codes within the file, malformed email, unknown `manager_email`, invalid date, and unknown `employment_status`. **Invalid rows fail individually**; valid rows still import. |
| FR-IMP-08 | M | Employees present in Dataverse but absent from the file are **never deleted**. An Admin may optionally mark them inactive as a separate, deliberate step. |
| FR-IMP-09 | M | **[v2]** Every import is retained as a batch record with file name, importer, timestamp, per-row outcome, and a downloadable failure file — supplemented by Dataverse's native import job history. |
| FR-IMP-10 | M | The manager hierarchy is resolved from `manager_email` **after** all rows land, so a manager appearing later in the file still links. Reporting cycles are reported as errors. |
| FR-IMP-11 | S | The import respects the platform's file size limits; oversized files are rejected with a clear message and guidance to split the file. |

### 5.4 Skill catalog and categories

| ID | Pri | Requirement |
|---|:--:|---|
| FR-CAT-01 | M | Skills are organised into skill categories. Every skill belongs to exactly one. |
| FR-CAT-02 | M | An Admin can create, rename, reorder, and deactivate categories. A category holding active skills cannot be deactivated without reassignment. |
| FR-CAT-03 | M | The solution ships with a seeded catalog covering at least: Programming Languages (C, C++, Java, Python, JavaScript, TypeScript, C#, Go), Test Automation (Selenium, Playwright, Cypress, Appium, JUnit, TestNG, PyTest, Robot Framework), Frameworks & Libraries, Cloud & DevOps, Databases, Tools & Platforms, and Process & Methodology. **[v2]** Seed data ships as **configuration data in the solution**, so every environment starts identical. |
| FR-CAT-04 | M | A **Manager or Admin can add a new skill** to the catalog — name, category, optional description — and it is immediately selectable. |
| FR-CAT-05 | M | Skill names are unique case-insensitively. **[v2]** Enforced by a **normalised-name column configured as a Dataverse alternate key**, so a duplicate is rejected by the platform rather than only by the UI. |
| FR-CAT-06 | S | A skill can carry searchable aliases (`JS` → `JavaScript`) without creating a separate skill. |
| FR-CAT-07 | M | An Admin can **deprecate** a skill: it leaves the selectable list but stays visible wherever it is already used. |
| FR-CAT-08 | S | An Admin can **merge** a duplicate skill into a target skill, moving all employee skills and assessments, keeping the higher rating on conflict. |
| FR-CAT-09 | S | A skill page shows the definition, category, how many employees hold it, the rating distribution, and the skill-level trend. |
| FR-CAT-10 | C | Manager-created skills can optionally require Admin approval before becoming generally selectable. |

### 5.5 Rating scale and rating descriptions

| ID | Pri | Requirement |
|---|:--:|---|
| FR-RAT-01 | M | Ratings are whole numbers **0 to 5**; `0` lowest, `5` highest. No other value is accepted. |
| FR-RAT-02 | M | Each level has a **short label** and a **written description**, shown wherever a rating is selected or displayed. |
| FR-RAT-03 | M | The default scale is `0 None`, `1 Awareness`, `2 Novice`, `3 Practitioner`, `4 Advanced`, `5 Expert`, with these default descriptions: |
| | | **0 — None:** No practical exposure; has not worked with the skill. |
| | | **1 — Awareness:** Understands the core concepts and vocabulary; cannot yet deliver work unaided. |
| | | **2 — Novice:** Completes simple, well-defined tasks with guidance and review. |
| | | **3 — Practitioner:** Works independently on routine tasks and resolves common problems without help. |
| | | **4 — Advanced:** Handles complex or ambiguous work, reviews others' work, and sets local standards. |
| | | **5 — Expert:** Recognised authority; designs standards, mentors across teams, and solves novel problems. |
| FR-RAT-04 | M | **[v2]** An Admin can edit each level's label and description **as data**, in a `Rating Level` table — not as a choice column — so wording changes need no solution deployment. |
| FR-RAT-05 | S | A category may override the level descriptions; where no override exists the global scale applies. |
| FR-RAT-06 | M | Separately from the scale, **every individual rating entry can carry a free-text note** — the justification or evidence for that specific rating. |

### 5.6 Recording and maintaining ratings

| ID | Pri | Requirement |
|---|:--:|---|
| FR-SKL-01 | M | A Manager or Admin can add a skill to an employee by selecting the skill and an initial rating. |
| FR-SKL-02 | M | **[v2]** The skill selector is a **Dataverse lookup with type-ahead search**, filtered to active skills and showing the category, so the list scales past a few hundred entries. |
| FR-SKL-03 | M | **[v2]** The rating selector is a **dropdown bound to the `Rating Level` table**, displaying `value — label`, with the level description shown next to the field. Because it is data-bound, edits under FR-RAT-04 appear immediately. |
| FR-SKL-04 | M | The skill selector offers an inline **"＋ New skill"** action so a manager can add to the catalog without leaving the form (FR-CAT-04). |
| FR-SKL-05 | M | Each rating entry captures rating, **effective date** (defaults to today, may be backdated, never future), and an optional note. |
| FR-SKL-06 | M | Updating a rating **appends a new assessment**; it never overwrites the previous one. |
| FR-SKL-07 | M | A new assessment sharing an effective date with an existing one supersedes it rather than creating a duplicate for that day. The user is warned first. |
| FR-SKL-08 | M | The employee skill's **current rating** always reflects the live assessment with the latest effective date. |
| FR-SKL-09 | M | **Date first acquired** is the effective date of the earliest live assessment, recalculated after any correction. |
| FR-SKL-10 | M | A Manager or Admin can **archive** an employee skill. Archived skills leave the active list and current-state trends; their history is preserved. |
| FR-SKL-11 | S | A Manager can set a **target rating** and target date, and the profile shows the gap against the current rating. |
| FR-SKL-12 | S | **[v2]** Bulk entry: rate one skill across several team members, or several skills for one employee, from a single screen — delivered as a **canvas app screen**, because a model-driven form is one record at a time. |
| FR-SKL-13 | M | A manager can never record a rating for an employee outside their scope; this is enforced by Dataverse privileges (FR-SEC-05). |

### 5.7 Corrections to historical records

| ID | Pri | Requirement |
|---|:--:|---|
| FR-HIS-01 | M | A Manager or Admin can **modify an existing historical assessment**: its rating, effective date, or note. |
| FR-HIS-02 | M | A correction **never overwrites** the original. The original is retained and marked superseded; a new row carries a link back to what it replaced. |
| FR-HIS-03 | M | A correction **requires a reason** of at least 10 characters. **[v2]** Enforced by a Dataverse **business rule** making the field required and by the form's save validation. |
| FR-HIS-04 | M | A Manager or Admin can **void** an assessment entered in error. It is excluded from the current rating and all trends but remains visible, marked voided, with its reason. |
| FR-HIS-05 | M | **[v2]** Nothing is ever deleted. The **Delete privilege on the `Skill Assessment` table is removed from every role**, including Admin, so deletion is not possible through the app, the API, or Excel. |
| FR-HIS-06 | M | After any correction or void, the current rating, first-acquired date, and all affected trends **recompute automatically** from the corrected timeline. |
| FR-HIS-07 | M | The history view distinguishes the **effective date** from the **created-on** timestamp and shows both. |
| FR-HIS-08 | S | Correcting an assessment older than a configurable window (default 12 months) shows an additional confirmation that trend history will shift. |

### 5.8 Audit trail **[v2 — mechanism changed]**

| ID | Pri | Requirement |
|---|:--:|---|
| FR-AUD-01 | M | **[v2]** **Dataverse auditing is enabled** at the environment level and on every solution table and column, so every create, update, and delete is recorded by the platform. |
| FR-AUD-02 | M | Each audit entry records timestamp, user, operation, the record, and the old and new value of each changed column. This is native Dataverse behaviour. |
| FR-AUD-03 | M | **[v2]** The audit log is **tamper-evident and not writable by the application**: Dataverse audit data cannot be edited, and only a System Administrator can delete audit partitions. Combined with FR-HIS-05, a rating's history cannot be rewritten by a manager. |
| FR-AUD-04 | M | **[v2]** Every record's **Audit History tab** in the model-driven app shows its full change trail. The employee profile additionally shows a consolidated, reader-friendly rating history built from the assessment timeline. |
| FR-AUD-05 | M | The rating history can be filtered by skill, category, assessor, action type, and date range. |
| FR-AUD-06 | M | A single skill's history is viewable on its own — the full progression of `Playwright` for one employee, from first entry to today, including corrections. |
| FR-AUD-07 | M | **[v2]** An Admin can review organisation-wide change activity through the Power Platform admin centre audit summary and through a Power BI page built on the assessment timeline. |
| FR-AUD-08 | S | Rating history is exportable to Excel for a selected date range. |
| FR-AUD-09 | M | **[v2]** Audit **retention must be set explicitly** (recommended: 7 years for the assessment timeline, which lives in normal tables, and the maximum practical retention for Dataverse audit logs, balanced against capacity — see NFR-07). |

### 5.9 Trends and analytics **[v2 — delivered in Power BI]**

| ID | Pri | Requirement |
|---|:--:|---|
| FR-TRD-01 | M | **Employee-level trend:** average rating across an employee's active skills over time, with skill count alongside. |
| FR-TRD-02 | M | **Employee × skill trend:** one line per selected skill showing how that rating moved, drawn as a **step line** to reflect carry-forward semantics. |
| FR-TRD-03 | M | **Skill-level trend:** average rating for one skill across a population of employees over time, plus the number of employees holding it. |
| FR-TRD-04 | M | The skill-level population is filterable by department, manager, designation, and location. |
| FR-TRD-05 | M | **Category trend:** average rating over time per skill category, for an employee or a population. |
| FR-TRD-06 | M | Granularity is selectable: **Monthly, Quarterly, Half-yearly, Yearly**. **[v2]** Half-year is not a native Power BI period and requires a custom date table (see ARCHITECTURE.md §7). |
| FR-TRD-07 | M | The window is selectable: last 6 months, 12 months, 2 years, all time, or a custom range. |
| FR-TRD-08 | M | Trends are computed from **effective dates**, so a backdated entry lands in the period it belongs to. |
| FR-TRD-09 | M | A rating **carries forward** between assessments: rated 3 in March and 4 in September means April–August read 3, not blank. Periods before the skill was acquired stay empty, not zero. |
| FR-TRD-10 | M | Superseded and voided assessments are excluded from every trend. |
| FR-TRD-11 | M | Each visual shows the change versus the previous period and supports hover for exact values. |
| FR-TRD-12 | S | **Rating distribution:** stacked columns of how many employees sit at each level for a skill, over time. |
| FR-TRD-13 | S | **Skill coverage matrix:** employees against skills, conditionally formatted by rating, to expose single points of failure. |
| FR-TRD-14 | S | **Category comparison:** an employee's per-category average against their team's average. |
| FR-TRD-15 | S | Every visual supports "show as table" and export of the underlying data, subject to the viewer's permissions. |
| FR-TRD-16 | M | **[v2]** Power BI reports are **embedded in the Power Apps experience** so managers do not switch tools, and are also published to a Power BI workspace app for direct consumption. |

### 5.10 Dashboard and reporting

| ID | Pri | Requirement |
|---|:--:|---|
| FR-DSH-01 | M | A landing report shows, for the viewer's scope: employees tracked, skills tracked, total ratings recorded, overall average rating, and ratings updated in the last 30 days. |
| FR-DSH-02 | M | Top skills by coverage, weakest-covered skills, and most recently updated profiles. |
| FR-DSH-03 | S | A **skill gap** panel listing skills where fewer than *N* people (default 2) are rated 3 or above. |
| FR-DSH-04 | S | A **staleness** panel listing employees or skills not reviewed in more than *N* months (default 6). |
| FR-DSH-05 | S | A recent-activity list of the latest rating changes, drillable to the record. |
| FR-DSH-06 | S | Export of the team skill matrix, per-employee history, and skill-level report to Excel. |

---

## 6. Non-functional requirements **[v2 — substantially revised]**

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | **Scale** | 2,000 employees, 300 catalog skills, ~100,000 employee-skill rows, ~500,000 assessments, 50 concurrent users. All comfortably within Dataverse limits; capacity is a storage and licensing question, not a technical one. |
| NFR-02 | **Performance** | Model-driven views and forms open within platform norms (sub-2 s typical). Power BI report pages render in under 5 s on a warm import-mode model. |
| NFR-03 | **Data freshness** | **The key platform trade-off.** Data entry is immediate in Dataverse; Power BI trends lag by the refresh interval. Requirement: trends must be **no more than 1 hour stale during business hours**. See ARCHITECTURE.md §8 for the refresh options and their licensing implications. |
| NFR-04 | **Security** | Enforced by Dataverse security roles, record ownership, Manager hierarchy security, and column security profiles. Power BI enforces the equivalent through row-level security. No security decision lives in app logic alone. |
| NFR-05 | **Auditability** | Dataverse auditing enabled on all solution tables and columns. It must be possible to reconstruct any employee's skill state as at any past date from the assessment timeline. |
| NFR-06 | **Data integrity** | Ratings constrained to 0–5 by the rating-level lookup. One row per employee-skill pair, enforced by an alternate key. Effective dates cannot be in the future. |
| NFR-07 | **Retention & backup** | Dataverse provides automatic backups with point-in-time restore inside the retention window. Audit log retention is set explicitly and reviewed against capacity consumption quarterly. |
| NFR-08 | **Usability** | A manager can record a new rating in three interactions or fewer from the employee record. All selectors support type-ahead. |
| NFR-09 | **Accessibility** | Power Apps and Power BI meet Microsoft's accessibility standards out of the box; the solution must not undermine them — every report page needs meaningful visual titles, alt text, a sensible tab order, and no reliance on colour alone to convey a rating. |
| NFR-10 | **Client support** | Current versions of Edge and Chrome; the Power Apps and Power BI mobile apps; and embedded delivery through Microsoft Teams. |
| NFR-11 | **Monitoring** | Solution health monitored through the Power Platform admin centre: API request limits, capacity consumption, failed imports, and Power BI refresh failures with alerting. |
| NFR-12 | **ALM** | Everything ships as a **managed solution** from a Dev environment through Test to Production. Configuration data (categories, skills, rating levels) is deployed with the Configuration Migration tool. No unmanaged changes in production. |
| NFR-13 | **Privacy** | Only work contact and organisational data is stored. No compensation, performance-review, or demographic data. |
| NFR-14 | **Configurability** | Rating-scale wording, categories, skills, and dashboard thresholds are all data or environment variables, changeable without a deployment. |
| NFR-15 | **Licensing** | **[v2]** A hard commercial constraint, not an afterthought. Dataverse use requires Power Apps Premium (or per-app) licences for anyone using the app, and Power BI Pro (or a Fabric capacity) for report consumers. See §8 and ARCHITECTURE.md §11. |

---

## 7. Key acceptance criteria

**AC-1 — Adding a skill with a rating**
Given a manager on a report's record, when they pick `Playwright` from the skill
lookup and `3 — Practitioner` from the rating dropdown with today's date, then
the skill appears at rating 3, the first-acquired date is today, one assessment
row exists, and the Dataverse Audit History tab shows the create with the manager
as the user.

**AC-2 — Progression is appended, not overwritten**
Given an employee rated 3 in `Java` effective 2026-03-15, when the manager records
4 effective 2026-09-20, then the current rating is 4, both rows exist, and the
Power BI employee × skill visual shows 3 from March through August and 4 from
September.

**AC-3 — Correcting an old record**
Given an assessment of 3 effective 2026-03-15, when a manager corrects it to 2
with a reason, then the original row remains marked superseded, a new row holds
rating 2, Power BI reads 2 for March–August after the next refresh, the current
rating recomputes, and Dataverse audit shows the change with user and timestamp.

**AC-4 — Correction without a reason is rejected**
Given the correction form, when the reason is blank or under 10 characters, then
the business rule blocks the save with a field-level message.

**AC-5 — Voiding**
Given an assessment entered in error, when it is voided, then it is excluded from
the current rating and all trends, the first-acquired date recomputes, and it
still appears in the history marked voided with its reason.

**AC-6 — Carry-forward in trends**
Given a single `Selenium` assessment of 4 effective 2025-11-10, when the employee
trend is viewed monthly for 12 months, then months before November 2025 exclude
Selenium and every month from November 2025 onward shows 4.

**AC-7 — Granularity switching**
Given a skill trend over 24 months, when granularity changes from Monthly to
Quarterly, then 8 points are shown, each being the state as at the last day of
that quarter, with the current period anchored to today. Half-yearly returns 4.

**AC-8 — Import review before commit**
Given a 100-row file where 3 rows have malformed emails, when it is imported,
then the live `Employee` table is unchanged, the staging review shows 97 valid
rows split into create/update/unchanged plus 3 errors with row numbers, and only
after promotion do the 97 rows apply.

**AC-9 — Manager scope enforced by the platform**
Given a manager whose reporting line excludes employee X, when they open X's
record, then it is read-only; and when the same manager attempts the update
through **Excel Online, the Dataverse API, or a Power BI write-back**, it is
refused — because the restriction is a Dataverse privilege, not app logic.

**AC-10 — Employee access**
Given an employee signed in, when they open their own profile, then skills,
trends, and rating history are visible; when they open a colleague's record,
skills and current ratings are visible but history and notes are not; and no
write operation is available anywhere.

**AC-11 — Duplicate skill prevention**
Given `Playwright` exists, when a manager adds `playwright`, then the Dataverse
alternate key rejects it and the app offers the existing skill.

**AC-12 — Rating bounds**
Given any entry path — form, canvas screen, Excel import, or API — when a value
outside `0..5` is supplied, then it is rejected, because ratings are a lookup to
the six `Rating Level` rows rather than a free numeric field.

**AC-13 — Deletion is impossible [v2]**
Given any user including an Admin, when they attempt to delete a `Skill
Assessment` row from the app, an Excel export round-trip, or the API, then the
platform refuses, because no security role holds the Delete privilege.

---

## 8. Licensing and capacity **[v2 — new]**

Licensing shapes the architecture, so it is a requirement rather than a
procurement footnote.

| Audience | Needs | Licence |
|---|---|---|
| Admins (2–3 people) | Full app + reports | Power Apps Premium + Power BI Pro |
| Managers (~50) | App write access + reports | Power Apps Premium (or per-app) + Power BI Pro |
| Employees (~2,000) | Read-only profile and directory | **See recommendation below** |

**Recommendation:** licensing 2,000 employees for Power Apps Premium is the single
largest cost in this solution and is disproportionate to read-only use. Two
alternatives:

1. **Power BI only for employees.** Deliver the employee experience entirely as a
   Power BI report with row-level security, consumed in Teams. Employees need
   Power BI Pro, or nothing at all if the workspace sits on a **Fabric capacity
   (F64 or above)**, where viewers are free. Managers and Admins keep Power Apps.
   *This is the recommended shape and is assumed by the architecture.*
2. **Licence everyone for Power Apps.** Simpler conceptually, materially more
   expensive.

Dataverse storage for the volumes in NFR-01 is modest; **audit log volume is the
item to watch**, since auditing every column on a high-write table consumes log
capacity. Retention must be set deliberately (FR-AUD-09).

---

## 9. Assumptions and constraints

1. The organisation already has Microsoft 365 with Entra ID, and a Power Platform
   tenant with environments available for Dev, Test, and Production.
2. Employee master data is authoritative in Excel and re-imported when the
   organisation changes. The solution is not the HR system of record.
3. The reporting hierarchy comes solely from `manager_email`; one manager per employee.
4. Ratings are manager-assessed. No self-assessment or peer input in v1.
5. Ratings are updated on an ad-hoc or review cadence, not daily — hence the
   carry-forward requirement (FR-TRD-09).
6. English only; no localisation in v1.
7. Pro-code extensions are excluded unless explicitly approved (PC-5, PC-6).

---

## 10. Delivery phases **[v2 — re-planned for the platform]**

| Phase | Contents | Outcome |
|---|---|---|
| **Phase 0 — Foundation** | Environments (Dev/Test/Prod), publisher and solution set-up, Entra security groups, Dataverse auditing switched on, ALM pipeline. | A governed place to build. |
| **Phase 1 — Data model & catalog** | Dataverse tables, relationships, alternate keys, `Rating Level` table with the 0–5 scale, seeded categories and skills as configuration data, security roles and hierarchy security. | The model exists and is secured. |
| **Phase 2 — Manager app** | Model-driven app: employee directory and form, skills subgrid, add-skill and update-rating forms with lookup and rating dropdowns, business rules for reasons and date validation, Audit History tab. | Managers can record and correct ratings. |
| **Phase 3 — Employee onboarding** | Import template, staging table, validation views, promotion process, manager-hierarchy resolution, import batch history. | Real employee data is in the system. |
| **Phase 4 — Power BI trends** | Semantic model, custom date table with half-year, carry-forward DAX measures, employee-level and skill-level report pages, all four granularities, row-level security, embedding into the app and Teams. | The analytical value lands. |
| **Phase 5 — Insight & polish** | Dashboard KPIs, gap and staleness pages, coverage matrix, distribution visuals, target ratings, bulk-entry canvas screen, skill merge, export paths. | Proactive management rather than record-keeping. |

---

## 11. Confirmed decisions

| Decision | Choice |
|---|---|
| Platform | **Power BI + Power Apps + Dataverse only** |
| Data store | Dataverse (single system of record) |
| Data entry | Model-driven app, with canvas screens for bulk entry |
| Analytics | Power BI, embedded into the app and Teams |
| Identity | Microsoft Entra ID (native) |
| Authorisation | Dataverse security roles + Manager hierarchy security + column security |
| Audit | Native Dataverse auditing, plus an append-only assessment timeline for reporting |
| Deletion policy | No Delete privilege on assessments for any role; corrections supersede, voids exclude |
| Employee data source | Excel import into a staging table, then promotion |
| Rating scale | 0–5 as a `Rating Level` table, editable as data |
| Employee licensing | Power BI–only experience recommended (§8) |

> **Superseded by this version:** the v1.0 decisions to build on Next.js, Prisma,
> PostgreSQL, Auth.js, and Docker. The prototype remains in this folder, parked.

---

## 12. Open questions **[v2]**

| # | Question | Why it matters | Default assumed |
|---|---|---|---|
| 1 | **Is Power Automate permitted?** It is part of the Power Platform but was not named in the constraint. | A flow is the natural low-code way to stamp the supersede fields on a correction, resolve the manager hierarchy after import, and recompute the derived current rating. Without it, these become either manual steps or canvas-app logic, which is more fragile. | Assumed **not permitted**; the architecture notes each place where a flow is the better answer. |
| 2 | **Should employees see their own assessment notes?** | Dataverse column security is per-user, not per-row, so "hide other people's notes but show your own" is not directly expressible. Supporting it needs a design change. | Assumed **no** for v1: employees see ratings, level descriptions, and dates, but not free-text notes. |
| 3 | **What refresh latency is acceptable for trends?** | Determines whether Power BI uses scheduled import (cheapest), DirectQuery (live but slower), or Fabric Link/Direct Lake (best, needs capacity). | Assumed **1 hour** during business hours (NFR-03). |
| 4 | **Is a Fabric capacity (F64+) available?** | Decides whether 2,000 employees can view Power BI for free or need Pro licences. This is the largest cost lever in §8. | Assumed **not yet**; both options are costed in the architecture. |
| 5 | **Do managers write only for their reporting line?** | Carried over from v1. The design assumes reporting-line scope with an Admin-granted org-wide role. | Assumed **reporting line**. |
| 6 | **Is there an existing competency framework** whose wording should replace FR-RAT-03? | The descriptions are data and editable at any time, so this is not blocking. | Assumed **no**; defaults ship. |
