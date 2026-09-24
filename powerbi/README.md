# Power BI semantic model

The analytical layer for the Employee Skills & Competency Management Dashboard,
as a `.pbip` project — plain text, reviewable in a pull request, and openable in
Power BI Desktop.

See [REQUIREMENTS.md](../REQUIREMENTS.md) §5.9 and
[ARCHITECTURE.md](../ARCHITECTURE.md) §7 for what it has to do and why.

```
powerbi/
  SkillsCompetency.pbip                    open this in Power BI Desktop
  SkillsCompetency.SemanticModel/
    definition/
      model.tmdl                           model settings and object references
      database.tmdl                        compatibility level
      expressions.tmdl                     the EnvironmentHost parameter
      relationships.tmdl                   6 relationships
      tables/                              8 tables
      roles/                               3 row-level security roles
  SkillsCompetency.Report/                 4 empty report pages, ready for visuals
  validate_model.py                        structural checks
  test_validator.py                        tests for the checks
```

---

## Before you open it

Two prerequisites, in this order.

1. **The Dataverse tables must exist.** Run the provisioning scripts in
   [`../powerplatform`](../powerplatform/README.md) first. Every query here reads
   from `skl_*` tables through the TDS endpoint.
2. **Set the environment host.** Open the `EnvironmentHost` parameter and replace
   `REPLACE-ME.crm.dynamics.com` with your environment host — **without** the
   `https://` scheme, e.g. `contoso.crm11.dynamics.com`. Every table reads the
   parameter, so this is the only place it is set.

Then open `SkillsCompetency.pbip`, set credentials to **Organizational account**,
and refresh.

---

## The model

```
Employee ─┐
          ├─< Employee Skill >─< Skill Assessment >── Rating Level
Skill ────┘         │
  │                 │
Skill Category      │
                    │
Manager Hierarchy ──┘   (security bridge, hidden)

Date  — deliberately unrelated to anything
```

| Table | Rows | Role |
|---|---|---|
| `Employee` | one per person | Directory dimension. `Email` is what row-level security matches on. |
| `Skill Category` | 7 | Grouping dimension. |
| `Skill` | ~80 | Catalog dimension. |
| `Rating Level` | 6 | The 0–5 scale, with the label and written description shown beside a rating. |
| `Employee Skill` | one per person per skill | Current state, plus the target-gap and staleness columns. |
| `Skill Assessment` | one per rating ever recorded | The fact table. Holds the timeline and all the as-of measures. |
| `Date` | 2020 → next year | Custom calendar including half-years. |
| `Manager Hierarchy` | one per (employee, manager above them) | Hidden security bridge. |

### Why `Date` has no relationship

An active join to `Skill Assessment[Effective Date]` would answer *"which
assessments happened in March"*. Every requirement here asks *"what was the
rating as at the end of March"* — a different question. The measures apply the
date filter themselves, which is what makes a rating **carry forward** through
periods containing no assessment.

This is the single most important modelling decision in the file. If someone
later "fixes" the missing relationship, every trend silently becomes wrong: stable
skills will appear as gaps.

### The as-of measures

`[Rating As Of]` is the base measure and the one worth understanding:

- It finds the most recent **live** assessment with an effective date on or
  before the end of the period in context.
- It returns **blank** when the skill had not been acquired yet — which is why
  pre-acquisition periods are empty rather than reading a misleading zero.
- It filters `[Is Live]`, so a correction made today retroactively reshapes the
  whole chart. That is intended (AC-3).

Everything else builds on it. `[Avg Rating As Of]` serves both the
employee-level trend and the skill-level trend — the only difference is the
filter context the visual supplies, so there is one measure rather than two.

`[Is Live]` is a calculated column meaning *not superseded and not voided*. It is
defined here rather than stored in Dataverse, because a stored flag is a third
thing to keep in step with the two columns it summarises.

### Granularity

`Month`, `Quarter`, `Half` and `Year` each have a sort column, so `Jan 2027`
follows `Dec 2026` instead of sorting alphabetically. To let a user switch the
axis with a slicer, add a **field parameter** over those four columns
(*Modeling → New parameter → Fields*) — one visual then serves all four periods
(FR-TRD-06).

Half-year is the reason for a custom calendar at all: Power BI has no native
half-year, so `Half`, `Half Sort` and `Half End` are built explicitly.

### Row-level security

| Role | Sees | Assign to |
|---|---|---|
| `Employee Self` | Their own record only | `Skills-Employees` group |
| `Manager Team` | Their whole reporting line, plus themselves | `Skills-Managers` group |
| `Organisation Wide` | Everything | `Skills-Admins` group |

`Manager Team` filters the `Manager Hierarchy` bridge, which reaches `Employee`
through that relationship's bidirectional security filtering. Power BI enforces
this **independently** of Dataverse — both derive from `Employee[Manager]`, so
they stay consistent, but both have to be configured.

Test with **Modeling → View as** before publishing.

---

## Validation

```powershell
python powerbi\validate_model.py     # structural checks
python powerbi\test_validator.py     # tests for those checks
```

`validate_model.py` catches the mistakes that are easy to make when hand-writing
TMDL and expensive to find by opening the file: structural indentation that is
not tabs, unbalanced ``` fences, `ref` statements with no definition,
relationships or DAX pointing at columns that do not exist, a `sortByColumn` that
is not a column of its own table, and a hard-coded Dataverse host instead of the
parameter.

`test_validator.py` seeds eleven deliberate faults into a temporary copy and
asserts each one is reported — because a validator that cannot fail tells you
nothing.

**What this does not prove.** There is no Power BI Desktop or Tabular Editor on
the machine this was authored on, so the model has **never been opened**. The
checks prove it is internally consistent; they cannot prove Desktop accepts every
TMDL property. Opening the `.pbip` is the real test, and it is the first thing to
do.

If Desktop does object to something, the content is still all there in readable
form. The fallback is to create a blank report, add the Dataverse tables, then
copy the DAX out of `tables/Skill Assessment.tmdl` and the M out of each
partition — nothing is locked inside a binary.

---

## Building the report pages

`SkillsCompetency.Report` ships with four named but empty pages, because a
hand-written `report.json` full of visual definitions is fragile and worse than
building them in Desktop. Suggested content, mapped to the requirements:

| Page | Visuals |
|---|---|
| **Overview** | Cards for `[Skills Tracked]`, `[Current Avg Rating]`, `[Ratings Updated Last 30 Days]`, `[Skills At 4 Plus]`. Top skills by coverage. Recent changes (FR-DSH-01/02/05). |
| **Employee trend** | Employee slicer. Line chart of `[Avg Rating As Of]` by the granularity field parameter, with `[Skills Held As Of]` on a second axis. Step line per skill. Category radar (FR-TRD-01/02/05). |
| **Skill trend** | Skill slicer, plus department and manager filters. `[Avg Rating As Of]` and `[Employees Holding As Of]` over time. Stacked columns of level distribution (FR-TRD-03/04/12). |
| **Coverage and gaps** | Matrix of Employee against Skill, conditionally formatted on `[Current Avg Rating]`. Skills where `[People At 3 Plus]` is below the threshold. `[Stale Skills]` (FR-TRD-13, FR-DSH-03/04). |

Two accessibility points that matter for NFR-09: give every visual a meaningful
title and alt text, and never encode a rating by colour alone — pair the
conditional formatting with the number.

---

## Refresh

Import mode. Refresh frequency is the live trade-off in
[ARCHITECTURE.md §8](../ARCHITECTURE.md):

| Licence | Refreshes per day | Meets the 1-hour target in NFR-03? |
|---|---|---|
| Power BI Pro | 8 | No |
| Premium per user | 48 (every 30 min) | Yes |
| Fabric F64+ with Direct Lake | near-live | Yes, and report viewing is free for employees |

Nothing about the tables, relationships or measures changes if you move between
these — only the storage mode.

---

## Data-quality measure worth watching

`[Current Rating Mismatches]` counts employee-skills where
`Employee Skill[Current Rating]` disagrees with the live timeline. **It should
always be zero.**

It exists because of the risk recorded in [ARCHITECTURE.md §12](../ARCHITECTURE.md):
without a Power Automate flow, a write that bypasses the app's rating screen can
leave that cached column stale. Put this measure on the Overview page during
rollout. A non-zero value means something wrote to Dataverse without going
through the app — which is exactly the argument for allowing one flow.
