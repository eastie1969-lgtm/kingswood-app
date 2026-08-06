param(
  [string]$ServiceId = "srv-d95qp87avr4c73aqd06g",
  [string]$SecureRoot = "C:\Users\Kev\OneDrive - Kingswood (London) Ltd\Documents\Kingswood Secure Secrets\Revolut Business API",
  [string]$BackupDir = "C:\Users\Kev\OneDrive - Kingswood (London) Ltd\Documents\Kingswood Hub\data\backups\render-hosted-data"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Convert-SecureStringToPlainText([securestring]$secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Invoke-RenderApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $headers = @{
    "Accept" = "application/json"
    "Authorization" = "Bearer $script:RenderApiKey"
  }
  $uri = "https://api.render.com/v1$Path"
  $params = @{
    Uri = $uri
    Method = $Method
    Headers = $headers
    TimeoutSec = 120
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 20)
  }
  Invoke-RestMethod @params
}

function Read-SecretFile([string]$relativePath) {
  $path = Join-Path $SecureRoot $relativePath
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required secure Revolut file missing: $relativePath"
  }
  Get-Content -LiteralPath $path -Raw
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $BackupDir "render-revolut-config-metadata-before-hosted-setup-$stamp.json"

$apiKeySecure = Read-Host "Enter Render API key" -AsSecureString
$script:RenderApiKey = Convert-SecureStringToPlainText $apiKeySecure
if ([string]::IsNullOrWhiteSpace($script:RenderApiKey)) {
  throw "Render API key was not supplied."
}

$secretFiles = @(
  @{ name = "revolut-oauth-tokens.secret.json"; content = Read-SecretFile "secrets\revolut-oauth-tokens.secret.json" },
  @{ name = "revolut-client-id.secret"; content = Read-SecretFile "secrets\revolut-client-id.secret" },
  @{ name = "revolut-jwt-issuer.secret"; content = Read-SecretFile "secrets\revolut-jwt-issuer.secret" },
  @{ name = "kingswood-revolut-private.pem"; content = Read-SecretFile "private\kingswood-revolut-private.pem" }
)

$metadata = [ordered]@{
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  serviceId = $ServiceId
  existingEnvVarNames = @()
  existingSecretFileNames = @()
  configuredSecretFileNames = @($secretFiles | ForEach-Object { $_.name })
  valuesBackedUp = $false
  note = "Secret values were not written to this metadata backup."
}

try {
  $envVars = Invoke-RenderApi -Method "GET" -Path "/services/$ServiceId/env-vars?limit=100"
  $metadata.existingEnvVarNames = @($envVars | ForEach-Object { $_.envVar.key })
} catch {
  $metadata.existingEnvVarNames = @("unavailable")
}

try {
  $existingSecretFiles = Invoke-RenderApi -Method "GET" -Path "/services/$ServiceId/secret-files?limit=100"
  $metadata.existingSecretFileNames = @($existingSecretFiles | ForEach-Object { $_.secretFile.name })
} catch {
  $metadata.existingSecretFileNames = @("unavailable")
}

($metadata | ConvertTo-Json -Depth 10) | Set-Content -LiteralPath $backupPath -Encoding UTF8

Invoke-RenderApi -Method "PUT" -Path "/services/$ServiceId/env-vars/REVOLUT_BUSINESS_API_DIR" -Body @{ value = "/var/data/revolut-business-api" } | Out-Null

foreach ($file in $secretFiles) {
  Invoke-RenderApi -Method "PUT" -Path "/services/$ServiceId/secret-files/$($file.name)" -Body @{ content = $file.content } | Out-Null
}

$deploy = Invoke-RenderApi -Method "POST" -Path "/services/$ServiceId/deploys" -Body @{ clearCache = "do_not_clear" }

$deployId = $deploy.id
$status = ""
$deadline = (Get-Date).AddMinutes(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 10
  $deploys = Invoke-RenderApi -Method "GET" -Path "/services/$ServiceId/deploys?limit=5"
  $current = @($deploys | Where-Object { $_.deploy.id -eq $deployId } | Select-Object -First 1)
  if ($current.Count -eq 0) { continue }
  $status = $current[0].deploy.status
  if ($status -in @("live", "build_failed", "update_failed", "canceled", "deactivated")) { break }
}

$script:RenderApiKey = $null
[pscustomobject]@{
  secureHostedConfigurationCompleted = $true
  metadataBackupPath = $backupPath
  deployStatus = $status
  secretsDisplayed = $false
} | ConvertTo-Json -Depth 5
