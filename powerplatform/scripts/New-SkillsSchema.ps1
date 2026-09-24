<#
.SYNOPSIS
    Provisions the Dataverse schema for the Employee Skills & Competency Dashboard.

.DESCRIPTION
    Reads schema/schema.json and creates the publisher, solution, tables, columns,
    relationships and alternate keys described there.

    Idempotent. Every component is checked before it is created, so a re-run after
    a partial failure picks up where it left off and reports what it skipped.

    Order matters and is deliberate:
      1. publisher and solution   - so every component lands in the solution
      2. tables with primary name - lookups need both ends to exist
      3. simple columns
      4. relationships            - these are what create the lookup columns
      5. alternate keys           - need their columns to exist first
      6. publish

.PARAMETER EnvironmentUrl
    e.g. https://contoso.crm11.dynamics.com

.EXAMPLE
    # Interactive, easiest for a first run
    .\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive

.EXAMPLE
    # Unattended, using an app registration
    .\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com `
        -TenantId $env:SKL_TENANT_ID -ClientId $env:SKL_CLIENT_ID -ClientSecret $env:SKL_CLIENT_SECRET

.EXAMPLE
    # See what would happen without changing anything
    .\New-SkillsSchema.ps1 -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive -WhatIf
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

    [string] $SchemaPath,

    [switch] $SkipPublish,

    # Checks the schema and builds every metadata payload without connecting to
    # anything. Use this to review what will be created before touching a tenant.
    [switch] $ValidateOnly,

    # With -ValidateOnly, also writes the generated payloads here as JSON.
    [string] $PayloadOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Import-Module (Join-Path $scriptRoot 'DataverseClient.psm1') -Force

if (-not $SchemaPath) {
    $SchemaPath = Join-Path (Split-Path -Parent $scriptRoot) 'schema/schema.json'
}
if (-not (Test-Path $SchemaPath)) {
    throw "Schema file not found: $SchemaPath"
}

$schema = Get-Content -Path $SchemaPath -Raw -Encoding UTF8 | ConvertFrom-Json

$summary = [ordered]@{
    TablesCreated        = 0; TablesSkipped        = 0
    ColumnsCreated       = 0; ColumnsSkipped       = 0
    RelationshipsCreated = 0; RelationshipsSkipped = 0
    KeysCreated          = 0; KeysSkipped          = 0
}

function Write-Step { param([string] $Text) Write-Host "`n$Text" -ForegroundColor Cyan }
function Write-Made { param([string] $Text) Write-Host "  + $Text" -ForegroundColor Green }
function Write-Kept { param([string] $Text) Write-Host "  = $Text (already present)" -ForegroundColor DarkGray }

function Get-PropertyOrDefault {
    param($Object, [string] $Name, $Default = $null)
    if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) {
        return $Object.$Name
    }
    return $Default
}

function New-ManagedBoolean {
    param([bool] $Value, [string] $LogicalName)
    return @{
        Value                      = $Value
        CanBeChanged               = $true
        ManagedPropertyLogicalName = $LogicalName
    }
}

function New-AttributePayload {
    <# Translates one column definition from schema.json into Dataverse metadata. #>
    param([Parameter(Mandatory)] $Column, [switch] $IsPrimaryName)

    $required = Get-PropertyOrDefault $Column 'required' 'None'
    $description = Get-PropertyOrDefault $Column 'description' ''

    $payload = @{
        SchemaName    = $Column.schemaName
        DisplayName   = New-DataverseLabel -Text $Column.displayName
        RequiredLevel = @{ Value = $required }
    }
    if ($description) {
        $payload['Description'] = New-DataverseLabel -Text $description
    }

    $type = if ($IsPrimaryName) { 'String' } else { $Column.type }

    switch ($type) {
        'String' {
            $payload['@odata.type']      = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
            $payload['AttributeType']    = 'String'
            $payload['AttributeTypeName'] = @{ Value = 'StringType' }
            $payload['MaxLength']        = [int] (Get-PropertyOrDefault $Column 'maxLength' 100)
            $payload['FormatName']       = @{ Value = (Get-PropertyOrDefault $Column 'format' 'Text') }
            if ($IsPrimaryName) {
                $payload['IsPrimaryName'] = $true
                $payload['RequiredLevel'] = @{ Value = 'SystemRequired' }
            }
        }
        'Memo' {
            $payload['@odata.type']      = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
            $payload['AttributeType']    = 'Memo'
            $payload['AttributeTypeName'] = @{ Value = 'MemoType' }
            $payload['MaxLength']        = [int] (Get-PropertyOrDefault $Column 'maxLength' 2000)
            $payload['Format']           = 'TextArea'
        }
        'Integer' {
            $payload['@odata.type']      = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
            $payload['AttributeType']    = 'Integer'
            $payload['AttributeTypeName'] = @{ Value = 'IntegerType' }
            $payload['MinValue']         = [int] (Get-PropertyOrDefault $Column 'minValue' 0)
            $payload['MaxValue']         = [int] (Get-PropertyOrDefault $Column 'maxValue' 2147483647)
            $payload['Format']           = 'None'
        }
        'DateTime' {
            $dateOnly = [bool] (Get-PropertyOrDefault $Column 'dateOnly' $true)
            $payload['@odata.type']      = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
            $payload['AttributeType']    = 'DateTime'
            $payload['AttributeTypeName'] = @{ Value = 'DateTimeType' }
            $payload['Format']           = if ($dateOnly) { 'DateOnly' } else { 'DateAndTime' }
            # DateOnly behaviour stores a calendar date with no timezone shift, which
            # is what an effective date needs (NFR-15).
            $payload['DateTimeBehavior'] = @{ Value = if ($dateOnly) { 'DateOnly' } else { 'UserLocal' } }
        }
        'Boolean' {
            $payload['@odata.type']      = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
            $payload['AttributeType']    = 'Boolean'
            $payload['AttributeTypeName'] = @{ Value = 'BooleanType' }
            $payload['DefaultValue']     = [bool] (Get-PropertyOrDefault $Column 'defaultValue' $false)
            $payload['OptionSet']        = @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
                TrueOption    = @{ Value = 1; Label = New-DataverseLabel -Text (Get-PropertyOrDefault $Column 'trueLabel' 'Yes') }
                FalseOption   = @{ Value = 0; Label = New-DataverseLabel -Text (Get-PropertyOrDefault $Column 'falseLabel' 'No') }
            }
        }
        'Choice' {
            $options = @()
            foreach ($option in $Column.options) {
                $options += @{
                    Value = [int] $option.value
                    Label = New-DataverseLabel -Text $option.label
                }
            }
            $payload['@odata.type']      = 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'
            $payload['AttributeType']    = 'Picklist'
            $payload['AttributeTypeName'] = @{ Value = 'PicklistType' }
            $payload['OptionSet']        = @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.OptionSetMetadata'
                IsGlobal      = $false
                OptionSetType = 'Picklist'
                Options       = $options
            }
            $default = Get-PropertyOrDefault $Column 'defaultValue' $null
            if ($null -ne $default) { $payload['DefaultFormValue'] = [int] $default }
        }
        default { throw "Unsupported column type '$type' on $($Column.schemaName)." }
    }

    return $payload
}

# ---------------------------------------------------------------------------
# Offline validation
# ---------------------------------------------------------------------------

if ($ValidateOnly) {
    Write-Step "Validating $SchemaPath"

    $problems = New-Object System.Collections.Generic.List[string]
    $payloads = [ordered]@{ tables = @(); columns = @(); relationships = @(); keys = @() }

    # Tables referenced by relationships may be ours or out-of-the-box Dataverse.
    $knownTables = @{}
    foreach ($table in $schema.tables) { $knownTables[$table.logicalName] = $true }
    foreach ($systemTable in @('systemuser', 'team', 'businessunit', 'account', 'contact')) {
        $knownTables[$systemTable] = $true
    }

    $seenTables = @{}
    foreach ($table in $schema.tables) {
        if ($seenTables.ContainsKey($table.logicalName)) {
            $problems.Add("Duplicate table logical name: $($table.logicalName)")
        }
        $seenTables[$table.logicalName] = $true

        if (-not $table.primaryAttribute) {
            $problems.Add("$($table.logicalName): no primaryAttribute defined")
            continue
        }

        try {
            $payloads.tables += [pscustomobject]@{
                table   = $table.logicalName
                payload = New-AttributePayload -Column $table.primaryAttribute -IsPrimaryName
            }
        }
        catch { $problems.Add("$($table.logicalName) primary attribute: $($_.Exception.Message)") }

        # Column names must be unique per table, including the primary one.
        $seenColumns = @{ $table.primaryAttribute.schemaName.ToLowerInvariant() = $true }

        foreach ($column in $table.columns) {
            $logical = $column.schemaName.ToLowerInvariant()
            if ($seenColumns.ContainsKey($logical)) {
                $problems.Add("$($table.logicalName): duplicate column $logical")
            }
            $seenColumns[$logical] = $true

            if ($column.schemaName -notmatch "^$($schema.publisher.prefix)_") {
                $problems.Add("$($table.logicalName).${logical}: missing publisher prefix")
            }

            try {
                $payloads.columns += [pscustomobject]@{
                    table   = $table.logicalName
                    column  = $logical
                    payload = New-AttributePayload -Column $column
                }
            }
            catch { $problems.Add("$($table.logicalName).$logical : $($_.Exception.Message)") }
        }

        foreach ($key in $table.alternateKeys) {
            foreach ($attribute in $key.attributes) {
                if (-not $seenColumns.ContainsKey($attribute.ToLowerInvariant())) {
                    $problems.Add("$($table.logicalName): alternate key $($key.schemaName) references unknown column $attribute")
                }
            }
            $payloads.keys += [pscustomobject]@{
                table = $table.logicalName
                key   = $key.schemaName
                on    = ($key.attributes -join ', ')
            }
        }
    }

    $seenRelationships = @{}
    foreach ($relationship in $schema.relationships) {
        if ($seenRelationships.ContainsKey($relationship.schemaName)) {
            $problems.Add("Duplicate relationship: $($relationship.schemaName)")
        }
        $seenRelationships[$relationship.schemaName] = $true

        foreach ($end in @('referencedTable', 'referencingTable')) {
            if (-not $knownTables.ContainsKey($relationship.$end)) {
                $problems.Add("$($relationship.schemaName): $end '$($relationship.$end)' is not a table in this schema")
            }
        }

        # The lookup lands on the referencing table, so it must not collide there.
        $owner = $schema.tables | Where-Object { $_.logicalName -eq $relationship.referencingTable }
        if ($owner) {
            $existing = @($owner.primaryAttribute.schemaName) + @($owner.columns | ForEach-Object { $_.schemaName })
            if ($existing -contains $relationship.lookup.schemaName) {
                $problems.Add("$($relationship.schemaName): lookup $($relationship.lookup.schemaName) collides with an existing column on $($relationship.referencingTable)")
            }
        }

        $payloads.relationships += [pscustomobject]@{
            relationship = $relationship.schemaName
            creates      = "$($relationship.referencingTable).$($relationship.lookup.schemaName.ToLowerInvariant())"
            pointsAt     = $relationship.referencedTable
        }
    }

    Write-Host ''
    Write-Host ('  tables          {0}' -f $payloads.tables.Count)
    Write-Host ('  columns         {0}' -f $payloads.columns.Count)
    Write-Host ('  lookups         {0}' -f $payloads.relationships.Count)
    Write-Host ('  alternate keys  {0}' -f $payloads.keys.Count)

    if ($PayloadOutputPath) {
        $payloads | ConvertTo-Json -Depth 100 | Set-Content -Path $PayloadOutputPath -Encoding UTF8
        Write-Host "`n  payloads written to $PayloadOutputPath" -ForegroundColor Gray
    }

    if ($problems.Count -gt 0) {
        Write-Host "`n$($problems.Count) problem(s) found:" -ForegroundColor Red
        foreach ($problem in $problems) { Write-Host "  - $problem" -ForegroundColor Red }
        exit 1
    }

    Write-Host "`nSchema is valid. Re-run without -ValidateOnly to apply it." -ForegroundColor Green
    exit 0
}

# ---------------------------------------------------------------------------
# Connect
# ---------------------------------------------------------------------------

if ($PSCmdlet.ParameterSetName -eq 'ClientSecret') {
    $null = Connect-Dataverse -EnvironmentUrl $EnvironmentUrl -TenantId $TenantId `
        -ClientId $ClientId -ClientSecret $ClientSecret
}
else {
    $null = Connect-Dataverse -EnvironmentUrl $EnvironmentUrl -Interactive
}

# ---------------------------------------------------------------------------
# Publisher and solution
# ---------------------------------------------------------------------------

Write-Step 'Publisher and solution'

$publisherRows = Get-DataverseRows -EntitySetName 'publishers' `
    -Query ('$select=publisherid,uniquename&$filter=uniquename eq ''{0}''' -f $schema.publisher.uniqueName)

if ($publisherRows.Count -gt 0) {
    $publisherId = $publisherRows[0].publisherid
    Write-Kept "publisher $($schema.publisher.uniqueName)"
}
elseif ($PSCmdlet.ShouldProcess($schema.publisher.uniqueName, 'Create publisher')) {
    $created = Invoke-Dataverse -Method Post -Path 'publishers' -ReturnRepresentation -Body @{
        uniquename                     = $schema.publisher.uniqueName
        friendlyname                   = $schema.publisher.friendlyName
        description                    = $schema.publisher.description
        customizationprefix            = $schema.publisher.prefix
        customizationoptionvalueprefix = [int] $schema.publisher.optionValuePrefix
    }
    $publisherId = $created.publisherid
    Write-Made "publisher $($schema.publisher.uniqueName)"
}
else { $publisherId = $null }

$solutionRows = Get-DataverseRows -EntitySetName 'solutions' `
    -Query ('$select=solutionid,uniquename&$filter=uniquename eq ''{0}''' -f $schema.solution.uniqueName)

if ($solutionRows.Count -gt 0) {
    Write-Kept "solution $($schema.solution.uniqueName)"
}
elseif ($publisherId -and $PSCmdlet.ShouldProcess($schema.solution.uniqueName, 'Create solution')) {
    $null = Invoke-Dataverse -Method Post -Path 'solutions' -Body @{
        uniquename             = $schema.solution.uniqueName
        friendlyname           = $schema.solution.friendlyName
        description            = $schema.solution.description
        version                = $schema.solution.version
        'publisherid@odata.bind' = "/publishers($publisherId)"
    }
    Write-Made "solution $($schema.solution.uniqueName)"
}

Set-DataverseSolution -UniqueName $schema.solution.uniqueName

# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

Write-Step 'Tables'

foreach ($table in $schema.tables) {
    if (Test-DataverseTable -LogicalName $table.logicalName) {
        Write-Kept $table.logicalName
        $summary.TablesSkipped++
        continue
    }

    if (-not $PSCmdlet.ShouldProcess($table.logicalName, 'Create table')) { continue }

    $primary = New-AttributePayload -Column $table.primaryAttribute -IsPrimaryName

    $payload = @{
        '@odata.type'         = 'Microsoft.Dynamics.CRM.EntityMetadata'
        SchemaName            = $table.schemaName
        DisplayName           = New-DataverseLabel -Text $table.displayName
        DisplayCollectionName = New-DataverseLabel -Text $table.pluralName
        Description           = New-DataverseLabel -Text $table.description
        OwnershipType         = $table.ownershipType
        IsActivity            = $false
        HasActivities         = $false
        HasNotes              = $false
        IsAuditEnabled        = New-ManagedBoolean -Value ([bool] $table.isAuditEnabled) -LogicalName 'canmodifyauditsettings'
        Attributes            = @($primary)
    }

    $null = Invoke-Dataverse -Method Post -Path 'EntityDefinitions' -Body $payload -InSolution
    Write-Made "$($table.logicalName)  ($($table.displayName))"
    $summary.TablesCreated++
}

# ---------------------------------------------------------------------------
# Columns
# ---------------------------------------------------------------------------

Write-Step 'Columns'

foreach ($table in $schema.tables) {
    Write-Host "  $($table.logicalName)" -ForegroundColor White

    foreach ($column in $table.columns) {
        $columnLogical = $column.schemaName.ToLowerInvariant()

        if (Test-DataverseColumn -TableLogicalName $table.logicalName -ColumnLogicalName $columnLogical) {
            Write-Kept "    $columnLogical"
            $summary.ColumnsSkipped++
            continue
        }

        if (-not $PSCmdlet.ShouldProcess("$($table.logicalName).$columnLogical", 'Create column')) { continue }

        $payload = New-AttributePayload -Column $column
        $null = Invoke-Dataverse -Method Post `
            -Path "EntityDefinitions(LogicalName='$($table.logicalName)')/Attributes" `
            -Body $payload -InSolution

        Write-Made "    $columnLogical  [$($column.type)]"
        $summary.ColumnsCreated++
    }
}

# ---------------------------------------------------------------------------
# Relationships - these create the lookup columns
# ---------------------------------------------------------------------------

Write-Step 'Relationships and lookups'

foreach ($relationship in $schema.relationships) {
    if (Test-DataverseRelationship -SchemaName $relationship.schemaName) {
        Write-Kept $relationship.schemaName
        $summary.RelationshipsSkipped++
        continue
    }

    if (-not $PSCmdlet.ShouldProcess($relationship.schemaName, 'Create relationship')) { continue }

    $lookup = @{
        '@odata.type'      = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
        AttributeType      = 'Lookup'
        AttributeTypeName  = @{ Value = 'LookupType' }
        SchemaName         = $relationship.lookup.schemaName
        DisplayName        = New-DataverseLabel -Text $relationship.lookup.displayName
        RequiredLevel      = @{ Value = (Get-PropertyOrDefault $relationship.lookup 'required' 'None') }
    }
    $lookupDescription = Get-PropertyOrDefault $relationship.lookup 'description' ''
    if ($lookupDescription) {
        $lookup['Description'] = New-DataverseLabel -Text $lookupDescription
    }

    $payload = @{
        '@odata.type'      = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
        SchemaName         = $relationship.schemaName
        ReferencedEntity   = $relationship.referencedTable
        ReferencingEntity  = $relationship.referencingTable
        Lookup             = $lookup
        CascadeConfiguration = @{
            Assign   = 'NoCascade'
            Delete   = (Get-PropertyOrDefault $relationship 'cascadeDelete' 'RemoveLink')
            Merge    = 'NoCascade'
            Reparent = 'NoCascade'
            Share    = 'NoCascade'
            Unshare  = 'NoCascade'
        }
        AssociatedMenuConfiguration = @{
            Behavior = 'UseCollectionName'
            Group    = 'Details'
            Order    = 10000
        }
    }

    $null = Invoke-Dataverse -Method Post -Path 'RelationshipDefinitions' -Body $payload -InSolution
    Write-Made "$($relationship.schemaName)  ->  $($relationship.referencingTable).$($relationship.lookup.schemaName.ToLowerInvariant())"
    $summary.RelationshipsCreated++
}

# ---------------------------------------------------------------------------
# Alternate keys
# ---------------------------------------------------------------------------

Write-Step 'Alternate keys'

foreach ($table in $schema.tables) {
    foreach ($key in $table.alternateKeys) {
        if (Test-DataverseAlternateKey -TableLogicalName $table.logicalName -SchemaName $key.schemaName) {
            Write-Kept $key.schemaName
            $summary.KeysSkipped++
            continue
        }

        if (-not $PSCmdlet.ShouldProcess("$($table.logicalName).$($key.schemaName)", 'Create alternate key')) { continue }

        $payload = @{
            '@odata.type' = 'Microsoft.Dynamics.CRM.EntityKeyMetadata'
            SchemaName    = $key.schemaName
            DisplayName   = New-DataverseLabel -Text $key.displayName
            KeyAttributes = @($key.attributes)
        }

        $null = Invoke-Dataverse -Method Post `
            -Path "EntityDefinitions(LogicalName='$($table.logicalName)')/Keys" `
            -Body $payload -InSolution

        # Key creation queues a background index job; it becomes Active shortly after.
        Write-Made "$($key.schemaName)  on $($table.logicalName) ($($key.attributes -join ', '))"
        $summary.KeysCreated++
    }
}

# ---------------------------------------------------------------------------
# Publish and report
# ---------------------------------------------------------------------------

if (-not $SkipPublish -and $PSCmdlet.ShouldProcess($EnvironmentUrl, 'Publish customizations')) {
    Publish-DataverseCustomizations
}

Write-Step 'Summary'
foreach ($entry in $summary.GetEnumerator()) {
    Write-Host ('  {0,-22} {1}' -f $entry.Key, $entry.Value)
}

Write-Host "`nNext:" -ForegroundColor Cyan
Write-Host '  1. .\Import-SkillsSeedData.ps1   - load categories, skills and the 0-5 rating scale'
Write-Host '  2. Configure security roles using the privilege matrix in ARCHITECTURE.md section 6.1'
Write-Host '  3. Build the model-driven app around these tables'
Write-Host ''
Write-Host 'Alternate-key indexes build in the background; allow a minute before relying on upsert.' -ForegroundColor DarkGray
