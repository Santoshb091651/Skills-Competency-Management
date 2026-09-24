<#
.SYNOPSIS
    Loads the seed configuration data: rating levels, skill categories and the
    starter skill catalog.

.DESCRIPTION
    Run after New-SkillsSchema.ps1. Idempotent - rows are matched on their natural
    key and updated in place, so re-running after editing a CSV pushes the edits
    rather than creating duplicates.

    Load order matters: rating levels first (independent), then categories, then
    skills, which need their category to exist.

.EXAMPLE
    .\Import-SkillsSeedData.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive

.EXAMPLE
    .\Import-SkillsSeedData.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive -WhatIf
#>
[CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = 'Interactive')]
param(
    [Parameter(Mandatory)]
    [string] $EnvironmentUrl,

    [Parameter(ParameterSetName = 'Interactive')]
    [switch] $Interactive,

    [Parameter(Mandatory, ParameterSetName = 'ClientSecret')]
    [string] $TenantId,

    [Parameter(Mandatory, ParameterSetName = 'ClientSecret')]
    [string] $ClientId,

    [Parameter(Mandatory, ParameterSetName = 'ClientSecret')]
    [string] $ClientSecret,

    [string] $DataPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Import-Module (Join-Path $scriptRoot 'DataverseClient.psm1') -Force

if (-not $DataPath) {
    $DataPath = Join-Path (Split-Path -Parent $scriptRoot) 'data'
}

$ratingLevelsCsv = Join-Path $DataPath 'rating-levels.csv'
$categoriesCsv   = Join-Path $DataPath 'skill-categories.csv'
$skillsCsv       = Join-Path $DataPath 'skills.csv'

foreach ($file in @($ratingLevelsCsv, $categoriesCsv, $skillsCsv)) {
    if (-not (Test-Path $file)) { throw "Seed file not found: $file" }
}

$summary = [ordered]@{
    RatingLevelsCreated = 0; RatingLevelsUpdated = 0
    CategoriesCreated   = 0; CategoriesUpdated   = 0
    SkillsCreated       = 0; SkillsUpdated       = 0
    SkillsFailed        = 0
}

function Write-Step { param([string] $Text) Write-Host "`n$Text" -ForegroundColor Cyan }
function Write-Made { param([string] $Text) Write-Host "  + $Text" -ForegroundColor Green }
function Write-Same { param([string] $Text) Write-Host "  ~ $Text" -ForegroundColor DarkGray }

function Get-NormalizedName {
    param([Parameter(Mandatory)][AllowEmptyString()][string] $Name)
    return $Name.Trim().ToLowerInvariant()
}

# ---------------------------------------------------------------------------

if ($PSCmdlet.ParameterSetName -eq 'ClientSecret') {
    $null = Connect-Dataverse -EnvironmentUrl $EnvironmentUrl -TenantId $TenantId `
        -ClientId $ClientId -ClientSecret $ClientSecret
}
else {
    $null = Connect-Dataverse -EnvironmentUrl $EnvironmentUrl -Interactive
}

$ratingLevelSet = Get-DataverseEntitySetName -LogicalName 'skl_ratinglevel'
$categorySet    = Get-DataverseEntitySetName -LogicalName 'skl_skillcategory'
$skillSet       = Get-DataverseEntitySetName -LogicalName 'skl_skill'

# ---------------------------------------------------------------------------
# Rating levels - the 0-5 scale (FR-RAT-03)
# ---------------------------------------------------------------------------

Write-Step 'Rating levels'

$existingLevels = Get-DataverseRows -EntitySetName $ratingLevelSet `
    -Query '$select=skl_ratinglevelid,skl_value,skl_label,skl_isglobal&$filter=skl_isglobal eq true'

foreach ($row in (Import-Csv -Path $ratingLevelsCsv)) {
    $value = [int] $row.value
    $displayName = "$value - $($row.label)"

    $record = @{
        skl_name        = $displayName
        skl_value       = $value
        skl_label       = $row.label
        skl_description = $row.description
        skl_isglobal    = $true
    }

    $match = $existingLevels | Where-Object { [int] $_.skl_value -eq $value } | Select-Object -First 1

    if ($match) {
        if ($PSCmdlet.ShouldProcess($displayName, 'Update rating level')) {
            $null = Invoke-Dataverse -Method Patch `
                -Path "$ratingLevelSet($($match.skl_ratinglevelid))" -Body $record
            Write-Same "$displayName (updated)"
            $summary.RatingLevelsUpdated++
        }
    }
    elseif ($PSCmdlet.ShouldProcess($displayName, 'Create rating level')) {
        $null = Invoke-Dataverse -Method Post -Path $ratingLevelSet -Body $record
        Write-Made $displayName
        $summary.RatingLevelsCreated++
    }
}

# ---------------------------------------------------------------------------
# Skill categories (FR-CAT-03)
# ---------------------------------------------------------------------------

Write-Step 'Skill categories'

$existingCategories = Get-DataverseRows -EntitySetName $categorySet `
    -Query '$select=skl_skillcategoryid,skl_name'

# Keyed case-insensitively so a CSV edit that changes only capitalisation does
# not create a second category.
$categoryIndex = @{}
foreach ($category in $existingCategories) {
    $categoryIndex[(Get-NormalizedName $category.skl_name)] = $category.skl_skillcategoryid
}

foreach ($row in (Import-Csv -Path $categoriesCsv)) {
    $key = Get-NormalizedName $row.name

    $record = @{
        skl_name         = $row.name
        skl_description  = $row.description
        skl_displayorder = [int] $row.displayOrder
        skl_isactive     = $true
    }

    if ($categoryIndex.ContainsKey($key)) {
        if ($PSCmdlet.ShouldProcess($row.name, 'Update category')) {
            $null = Invoke-Dataverse -Method Patch `
                -Path "$categorySet($($categoryIndex[$key]))" -Body $record
            Write-Same "$($row.name) (updated)"
            $summary.CategoriesUpdated++
        }
    }
    elseif ($PSCmdlet.ShouldProcess($row.name, 'Create category')) {
        $created = Invoke-Dataverse -Method Post -Path $categorySet -Body $record -ReturnRepresentation
        $categoryIndex[$key] = $created.skl_skillcategoryid
        Write-Made $row.name
        $summary.CategoriesCreated++
    }
}

# ---------------------------------------------------------------------------
# Skill catalog (FR-CAT-03)
# ---------------------------------------------------------------------------

Write-Step 'Skill catalog'

$existingSkills = Get-DataverseRows -EntitySetName $skillSet `
    -Query '$select=skl_skillid,skl_normalizedname'

$skillIndex = @{}
foreach ($skill in $existingSkills) {
    if ($skill.skl_normalizedname) { $skillIndex[$skill.skl_normalizedname] = $skill.skl_skillid }
}

foreach ($row in (Import-Csv -Path $skillsCsv)) {
    $normalized = Get-NormalizedName $row.name
    $categoryKey = Get-NormalizedName $row.category

    if (-not $categoryIndex.ContainsKey($categoryKey)) {
        Write-Warning "Skipping '$($row.name)': category '$($row.category)' does not exist."
        $summary.SkillsFailed++
        continue
    }

    $record = @{
        skl_name                  = $row.name
        skl_normalizedname        = $normalized
        skl_description           = $row.description
        skl_aliases               = $row.aliases
        skl_status                = 421000000   # Active
        'skl_Category@odata.bind' = "/$categorySet($($categoryIndex[$categoryKey]))"
    }

    try {
        if ($skillIndex.ContainsKey($normalized)) {
            if ($PSCmdlet.ShouldProcess($row.name, 'Update skill')) {
                $null = Invoke-Dataverse -Method Patch `
                    -Path "$skillSet($($skillIndex[$normalized]))" -Body $record
                Write-Same "$($row.name) (updated)"
                $summary.SkillsUpdated++
            }
        }
        elseif ($PSCmdlet.ShouldProcess($row.name, 'Create skill')) {
            $null = Invoke-Dataverse -Method Post -Path $skillSet -Body $record
            Write-Made "$($row.name)  [$($row.category)]"
            $summary.SkillsCreated++
        }
    }
    catch {
        # One bad row should not abandon the rest of the catalog.
        Write-Warning "Failed '$($row.name)': $($_.Exception.Message)"
        $summary.SkillsFailed++
    }
}

# ---------------------------------------------------------------------------

Write-Step 'Summary'
foreach ($entry in $summary.GetEnumerator()) {
    Write-Host ('  {0,-22} {1}' -f $entry.Key, $entry.Value)
}

if ($summary.SkillsFailed -gt 0) {
    Write-Host "`n$($summary.SkillsFailed) skill(s) did not load. Review the warnings above." -ForegroundColor Yellow
}

Write-Host "`nNext:" -ForegroundColor Cyan
Write-Host '  1. Confirm the 0-5 wording with the business and edit Rating Levels in the app if needed'
Write-Host '  2. Configure security roles using the privilege matrix in ARCHITECTURE.md section 6.1'
Write-Host '  3. Import employee data using templates/employee-import-template.xlsx'
