# Power Platform solution — data layer

Source for the Dataverse side of the Employee Skills & Competency Management
Dashboard. Everything here is text, version-controlled, and re-runnable.

See [REQUIREMENTS.md](../REQUIREMENTS.md) and [ARCHITECTURE.md](../ARCHITECTURE.md)
for what is being built and why.

```
powerplatform/
  schema/
    schema.json                     8 tables, 52 columns, 13 relationships, 5 alternate keys
  scripts/
    DataverseClient.psm1            auth + Web API wrapper (no modules to install)
    New-SkillsSchema.ps1            creates the publisher, solution, tables, columns, lookups, keys
    Import-SkillsSeedData.ps1       loads the rating scale, categories and skill catalog
  data/
    rating-levels.csv               the 0-5 scale with its descriptions
    skill-categories.csv            7 categories
    skills.csv                      80 starter skills
  templates/
    build_template.py               regenerates the workbook below
    employee-import-template.xlsx   the employee import template (FR-IMP-02)
```

---

## Prerequisites

| Need | Detail |
|---|---|
| A Dataverse environment | Its URL, e.g. `https://contoso.crm11.dynamics.com`. A developer or sandbox environment is fine to start. |
| System Customizer or System Administrator | Required to create tables and a solution. |
| PowerShell | Windows PowerShell 5.1 or PowerShell 7. Both are supported; nothing needs installing. |

No Power Platform CLI, no .NET SDK, no PowerShell modules. The scripts call the
Dataverse Web API directly with `Invoke-RestMethod`.

---

## Signing in

### Option A — interactive (easiest for a first run)

Nothing to set up. The script prints a code, you sign in with your work account
in a browser, and it continues.

```powershell
cd powerplatform\scripts
.\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive
```

This uses Microsoft's public client registration, which is pre-consented for
Dataverse, so no app registration is needed. Your own permissions apply.

### Option B — app registration (repeatable and unattended)

Better for running the same thing across Dev, Test and Production.

1. In **Entra ID → App registrations**, create an app. Note the
   **Application (client) ID** and **Directory (tenant) ID**.
2. Under **Certificates & secrets**, create a client secret.
3. Under **API permissions**, add **Dynamics CRM → user_impersonation** and grant
   admin consent.
4. In the **Power Platform admin centre → your environment → Settings → Users +
   permissions → Application users**, add a new app user for that client ID and
   give it the **System Customizer** role.

```powershell
$env:SKL_TENANT_ID     = '<tenant-guid>'
$env:SKL_CLIENT_ID     = '<client-guid>'
$env:SKL_CLIENT_SECRET = '<secret>'

.\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com `
    -TenantId $env:SKL_TENANT_ID -ClientId $env:SKL_CLIENT_ID -ClientSecret $env:SKL_CLIENT_SECRET
```

---

## Run order

```powershell
cd powerplatform\scripts

# 0. Check the schema without connecting to anything
.\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -ValidateOnly

# 1. See exactly what would be created, without creating it
.\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive -WhatIf

# 2. Create the schema
.\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive

# 3. Load the rating scale, categories and skill catalog
.\Import-SkillsSeedData.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive
```

Both scripts are **idempotent**. Every component is checked before it is created,
so a re-run after a network failure or a timeout picks up where it stopped and
tells you what it skipped. Re-running the seed import after editing a CSV pushes
the edits rather than creating duplicates.

`-ValidateOnly` also accepts `-PayloadOutputPath <file>` to dump every generated
metadata payload as JSON for review.

### Expected result

```
  TablesCreated          8
  ColumnsCreated        52
  RelationshipsCreated  13
  KeysCreated            5

  RatingLevelsCreated    6
  CategoriesCreated      7
  SkillsCreated         80
```

---

## What the schema creates

| Table | Purpose |
|---|---|
| `skl_employee` | Employee master data from Excel. Self-referencing `Manager` lookup drives write scope. |
| `skl_skillcategory` | Skill groupings. |
| `skl_skill` | The catalog. `NormalizedName` alternate key enforces case-insensitive uniqueness. |
| `skl_ratinglevel` | Six rows, 0–5, each with a label and a written description. |
| `skl_employeeskill` | One row per employee per skill; current state. |
| `skl_skillassessment` | The append-only rating timeline — the progression. |
| `skl_importbatch` | One employee-data upload. |
| `skl_importstaging` | One row per spreadsheet row, validated before promotion. |

Three details worth knowing:

**Ratings cannot be out of range.** `skl_skillassessment.skl_RatingLevel` is a
lookup to the six `Rating Level` rows. A form, a bulk import and a direct API call
all have to reference a real level, so 0–5 holds everywhere (AC-12).

**Duplicate skills are rejected by the platform.** The alternate key on
`skl_normalizedname` means `playwright` cannot be created alongside `Playwright`
(AC-11). Alternate-key indexes build in the background, so allow a minute after
provisioning before relying on upsert.

**There is no stored `IsLive` column.** "Live" means `Superseded On` is blank and
`Assessment Status` is Active. A stored flag would be a third thing to keep in
step with the two columns it summarises, so instead the condition is expressed as
a view filter in Dataverse and as a calculated column in the Power BI model.

---

## Not automated, and why

These are deliberately left to the maker portal.

| Step | Why not scripted |
|---|---|
| **Security roles and privileges** | Getting these wrong is the highest-consequence mistake in the solution, and a half-applied role script is worse than a checklist. Configure them by hand against the privilege matrix in [ARCHITECTURE.md §6.1](../ARCHITECTURE.md), which lists every table, privilege and access level. Remember the one that matters most: **Delete = None on `skl_skillassessment` for every role**, including Admin. |
| **Manager hierarchy security** | One switch in **Settings → Security → Hierarchy security**, set to Manager hierarchy. Faster to click than to script. |
| **Column security profile** | Applies to `skl_note` and `skl_changereason`, granted to Admin and Manager only. |
| **Model-driven app, forms and views** | App designer work. The tables, relationships and descriptions this script creates are what you build it on. |
| **Business rules** | Reason required on correction or void; no future effective date; target date needs a target rating. Listed in [ARCHITECTURE.md §9.3](../ARCHITECTURE.md). |
| **Power BI semantic model** | Next deliverable, as a `.pbip`/TMDL project. |

---

## Employee import template

`templates/employee-import-template.xlsx` has three sheets: the **Employees**
sheet to fill in, an **Instructions** sheet documenting every column rule, and a
**Reference** sheet behind the `employment_status` dropdown. Required columns are
shaded darker in the header, the date column is pre-formatted as text so Excel
cannot silently reinterpret it, and the example row is marked for deletion.

Regenerate it after changing the columns:

```powershell
pip install openpyxl
python ..\templates\build_template.py
```

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Client-credentials sign-in failed` | The app registration has no application user in the environment, or it lacks the System Customizer role. |
| `Device-code sign-in timed out` | The browser step was not completed within the window. Re-run. |
| `401 Unauthorized` partway through | Tokens last about an hour. Re-run the script — it resumes from where it stopped. |
| `Duplicate SchemaName` | The component exists but under a different logical name, usually from a hand-made earlier attempt. Delete it in the maker portal or rename it in `schema.json`. |
| Alternate key shows as *Pending* | Index creation is asynchronous. It becomes Active within a minute or two. |
| Non-ASCII text arrives mangled | Should not happen: request bodies are UTF-8 encoded explicitly. Report it if it does. |

---

## Changing the schema

Edit `schema/schema.json`, run with `-ValidateOnly`, then re-run to apply. The
script only ever **adds** components — it does not rename, retype or remove them,
because those operations are destructive and belong in a reviewed migration
rather than a provisioning script.
