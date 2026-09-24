<#
.SYNOPSIS
    Minimal Dataverse Web API client for the Skills & Competency solution.

.DESCRIPTION
    Dependency-free: no Power Platform CLI, no .NET SDK, no PowerShell modules to
    install. Uses Invoke-RestMethod against the Dataverse Web API and the Entra ID
    token endpoints directly.

    Compatible with Windows PowerShell 5.1 and PowerShell 7.

    Two sign-in modes:
      Client credentials  - an Entra app registration with an application user in
                            Dataverse. Best for repeatable, unattended runs.
      Device code         - interactive sign-in for a quick one-off run.
#>

Set-StrictMode -Version Latest

# Windows PowerShell 5.1 still negotiates TLS 1.0 by default, which Entra rejects.
if ([Net.ServicePointManager]::SecurityProtocol -notmatch 'Tls12') {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

# Microsoft's public client registration, pre-consented for Dataverse. Used only
# for the interactive device-code path so no app registration is needed to try
# the scripts out.
$script:PublicClientId = '51f81489-12ee-4a9e-aaae-a2591f45987d'
$script:ApiVersion = 'v9.2'
$script:Context = $null

function Get-ErrorBody {
    <#  Extracts a useful message from a failed Invoke-RestMethod on either
        PowerShell edition. PS7 populates ErrorDetails; 5.1 needs the raw stream. #>
    param([Parameter(Mandatory)] $ErrorRecord)

    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
        return $ErrorRecord.ErrorDetails.Message
    }

    try {
        $response = $ErrorRecord.Exception.Response
        if ($response -and $response.PSObject.Methods.Name -contains 'GetResponseStream') {
            $stream = $response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
    }
    catch {
        # fall through to the generic message
    }

    return $ErrorRecord.Exception.Message
}

function ConvertTo-DataverseJson {
    param([Parameter(Mandatory)] $InputObject)
    # PS 5.1 defaults to a depth of 2, which silently truncates metadata payloads.
    return ($InputObject | ConvertTo-Json -Depth 100 -Compress:$false)
}

function Connect-Dataverse {
    <#
    .SYNOPSIS
        Signs in and stores the connection for subsequent calls.

    .EXAMPLE
        Connect-Dataverse -EnvironmentUrl https://contoso.crm11.dynamics.com -Interactive

    .EXAMPLE
        Connect-Dataverse -EnvironmentUrl https://contoso.crm11.dynamics.com `
                          -TenantId  $env:SKL_TENANT_ID `
                          -ClientId  $env:SKL_CLIENT_ID `
                          -ClientSecret $env:SKL_CLIENT_SECRET
    #>
    [CmdletBinding(DefaultParameterSetName = 'Interactive')]
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

        [Parameter(ParameterSetName = 'Interactive')]
        [string] $InteractiveTenantId = 'organizations',

        [string] $SolutionUniqueName
    )

    $resource = $EnvironmentUrl.TrimEnd('/')

    if ($PSCmdlet.ParameterSetName -eq 'ClientSecret') {
        $tokenUri = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"
        $body = @{
            grant_type    = 'client_credentials'
            client_id     = $ClientId
            client_secret = $ClientSecret
            scope         = "$resource/.default"
        }

        try {
            $token = Invoke-RestMethod -Method Post -Uri $tokenUri -Body $body -ErrorAction Stop
        }
        catch {
            throw "Client-credentials sign-in failed. $(Get-ErrorBody $_)"
        }
    }
    else {
        $deviceUri = "https://login.microsoftonline.com/$InteractiveTenantId/oauth2/v2.0/devicecode"
        $tokenUri = "https://login.microsoftonline.com/$InteractiveTenantId/oauth2/v2.0/token"

        try {
            $codeResponse = Invoke-RestMethod -Method Post -Uri $deviceUri -ErrorAction Stop -Body @{
                client_id = $script:PublicClientId
                scope     = "$resource/user_impersonation offline_access openid profile"
            }
        }
        catch {
            throw "Could not start device-code sign-in. $(Get-ErrorBody $_)"
        }

        Write-Host ''
        Write-Host $codeResponse.message -ForegroundColor Cyan
        Write-Host ''

        $deadline = (Get-Date).AddSeconds([int] $codeResponse.expires_in)
        $interval = [Math]::Max([int] $codeResponse.interval, 3)
        $token = $null

        while ($null -eq $token -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds $interval
            try {
                $token = Invoke-RestMethod -Method Post -Uri $tokenUri -ErrorAction Stop -Body @{
                    grant_type  = 'urn:ietf:params:oauth:grant-type:device_code'
                    client_id   = $script:PublicClientId
                    device_code = $codeResponse.device_code
                }
            }
            catch {
                $detail = Get-ErrorBody $_
                # authorization_pending is the expected response until the user finishes.
                if ($detail -notmatch 'authorization_pending' -and $detail -notmatch 'slow_down') {
                    throw "Device-code sign-in failed. $detail"
                }
                if ($detail -match 'slow_down') { $interval += 5 }
            }
        }

        if ($null -eq $token) { throw 'Device-code sign-in timed out.' }
    }

    $script:Context = [pscustomobject]@{
        EnvironmentUrl     = $resource
        ApiRoot            = "$resource/api/data/$script:ApiVersion"
        AccessToken        = $token.access_token
        ExpiresOn          = (Get-Date).AddSeconds([int] $token.expires_in - 120)
        SolutionUniqueName = $SolutionUniqueName
    }

    # Cheap round trip that also proves the token is accepted by this environment.
    $who = Invoke-Dataverse -Method Get -Path 'WhoAmI'
    Write-Host "Connected to $resource" -ForegroundColor Green
    Write-Host "  user id:         $($who.UserId)"
    Write-Host "  organization id: $($who.OrganizationId)"

    return $script:Context
}

function Assert-DataverseConnection {
    if ($null -eq $script:Context) {
        throw 'Not connected. Run Connect-Dataverse first.'
    }
    if ((Get-Date) -ge $script:Context.ExpiresOn) {
        throw 'The access token has expired. Run Connect-Dataverse again.'
    }
}

function Set-DataverseSolution {
    <# Components created after this call are added to the named solution. #>
    param([Parameter(Mandatory)][string] $UniqueName)
    Assert-DataverseConnection
    $script:Context.SolutionUniqueName = $UniqueName
}

function Invoke-Dataverse {
    <#
    .SYNOPSIS
        Calls the Dataverse Web API.

    .PARAMETER Path
        Relative to /api/data/v9.2, e.g. 'EntityDefinitions' or "skl_skills(<id>)".

    .PARAMETER InSolution
        Adds the MSCRM.SolutionUniqueName header so created components land in the
        solution rather than in Default.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('Get', 'Post', 'Patch', 'Put', 'Delete')]
        [string] $Method,

        [Parameter(Mandatory)]
        [string] $Path,

        $Body,

        [switch] $InSolution,

        [hashtable] $ExtraHeaders,

        [switch] $ReturnRepresentation
    )

    Assert-DataverseConnection

    $headers = @{
        'Authorization'    = "Bearer $($script:Context.AccessToken)"
        'Accept'           = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }

    if ($InSolution -and $script:Context.SolutionUniqueName) {
        $headers['MSCRM.SolutionUniqueName'] = $script:Context.SolutionUniqueName
    }
    if ($ReturnRepresentation) {
        $headers['Prefer'] = 'return=representation'
    }
    if ($ExtraHeaders) {
        foreach ($key in $ExtraHeaders.Keys) { $headers[$key] = $ExtraHeaders[$key] }
    }

    $uri = if ($Path -match '^https?://') { $Path } else { "$($script:Context.ApiRoot)/$($Path.TrimStart('/'))" }

    $params = @{
        Method      = $Method
        Uri         = $uri
        Headers     = $headers
        ErrorAction = 'Stop'
    }

    if ($null -ne $Body) {
        $params['ContentType'] = 'application/json; charset=utf-8'
        $json = if ($Body -is [string]) { $Body } else { ConvertTo-DataverseJson $Body }
        # Encode explicitly: PS 5.1 would otherwise send ISO-8859-1 and mangle
        # anything non-ASCII in a label or description.
        $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($json)
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $detail = Get-ErrorBody $_
        throw "Dataverse $Method $Path failed.`n$detail"
    }
}

function Test-DataverseTable {
    param([Parameter(Mandatory)][string] $LogicalName)
    Assert-DataverseConnection
    try {
        $null = Invoke-Dataverse -Method Get `
            -Path "EntityDefinitions(LogicalName='$LogicalName')?`$select=LogicalName"
        return $true
    }
    catch { return $false }
}

function Test-DataverseColumn {
    param(
        [Parameter(Mandatory)][string] $TableLogicalName,
        [Parameter(Mandatory)][string] $ColumnLogicalName
    )
    Assert-DataverseConnection
    try {
        $null = Invoke-Dataverse -Method Get `
            -Path "EntityDefinitions(LogicalName='$TableLogicalName')/Attributes(LogicalName='$ColumnLogicalName')?`$select=LogicalName"
        return $true
    }
    catch { return $false }
}

function Test-DataverseRelationship {
    param([Parameter(Mandatory)][string] $SchemaName)
    Assert-DataverseConnection
    try {
        $result = Invoke-Dataverse -Method Get `
            -Path "RelationshipDefinitions?`$select=SchemaName&`$filter=SchemaName eq '$SchemaName'"
        return ($result.value.Count -gt 0)
    }
    catch { return $false }
}

function Test-DataverseAlternateKey {
    param(
        [Parameter(Mandatory)][string] $TableLogicalName,
        [Parameter(Mandatory)][string] $SchemaName
    )
    Assert-DataverseConnection
    try {
        $result = Invoke-Dataverse -Method Get `
            -Path "EntityDefinitions(LogicalName='$TableLogicalName')/Keys?`$select=SchemaName&`$filter=SchemaName eq '$SchemaName'"
        return ($result.value.Count -gt 0)
    }
    catch { return $false }
}

function Get-DataverseEntitySetName {
    <#
        Dataverse generates the collection name for a table and it does not always
        match naive pluralisation. Ask the metadata rather than guessing.
    #>
    param([Parameter(Mandatory)][string] $LogicalName)
    Assert-DataverseConnection

    if (-not $script:EntitySetCache) { $script:EntitySetCache = @{} }
    if ($script:EntitySetCache.ContainsKey($LogicalName)) {
        return $script:EntitySetCache[$LogicalName]
    }

    $definition = Invoke-Dataverse -Method Get `
        -Path "EntityDefinitions(LogicalName='$LogicalName')?`$select=EntitySetName"

    $script:EntitySetCache[$LogicalName] = $definition.EntitySetName
    return $definition.EntitySetName
}

function Get-DataverseRows {
    <# Retrieves rows, following @odata.nextLink so large tables come back whole. #>
    param(
        [Parameter(Mandatory)][string] $EntitySetName,
        [string] $Query
    )
    Assert-DataverseConnection

    $path = if ($Query) { "$EntitySetName`?$Query" } else { $EntitySetName }
    $rows = @()

    $page = Invoke-Dataverse -Method Get -Path $path
    $rows += $page.value

    while ($page.PSObject.Properties.Name -contains '@odata.nextLink' -and $page.'@odata.nextLink') {
        $page = Invoke-Dataverse -Method Get -Path $page.'@odata.nextLink'
        $rows += $page.value
    }

    return $rows
}

function Publish-DataverseCustomizations {
    Assert-DataverseConnection
    Write-Host 'Publishing customizations...' -ForegroundColor Gray
    $null = Invoke-Dataverse -Method Post -Path 'PublishAllXml' -Body @{}
    Write-Host 'Published.' -ForegroundColor Green
}

function New-DataverseLabel {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string] $Text,
        [int] $LanguageCode = 1033
    )
    return @{
        '@odata.type'    = 'Microsoft.Dynamics.CRM.Label'
        'LocalizedLabels' = @(
            @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'
                'Label'       = $Text
                'LanguageCode' = $LanguageCode
            }
        )
    }
}

Export-ModuleMember -Function `
    Connect-Dataverse, Set-DataverseSolution, Invoke-Dataverse, `
    Test-DataverseTable, Test-DataverseColumn, Test-DataverseRelationship, Test-DataverseAlternateKey, `
    Get-DataverseRows, Get-DataverseEntitySetName, Publish-DataverseCustomizations, `
    New-DataverseLabel, Get-ErrorBody
