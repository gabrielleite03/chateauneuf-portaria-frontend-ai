param(
  [Parameter(Mandatory = $true)]
  [string]$GoogleCredentialsFile,

  [Parameter(Mandatory = $true)]
  [string]$GoogleSheetId,

  [string]$FrontendImage = "gabrielleite03/chateauneuf-portaria-frontend:2026.07.14.1",
  [string]$BackendImage = "gabrielleite03/chateauneuf-portaria-backend:2026.07.14.3",
  [string]$FrontendPort = "8081",
  [string]$BackendPort = "18080",
  [string]$GoogleSheetName = "Entradas",
  [string]$GoogleDriveFolderId = "",
  [string]$LocalDataDir = ".\data",
  [string]$LocalPhotoDir = ".\photos",
  [string]$SyncIntervalSeconds = "30",
  [switch]$Pull,
  [switch]$Up,
  [switch]$Build
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Comando Docker falhou: docker $($Arguments -join ' ')"
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$credentialsPath = Resolve-Path -LiteralPath $GoogleCredentialsFile
$secretsDir = Join-Path $projectRoot "secrets"
$targetCredentials = Join-Path $secretsDir "google-service-account.json"
$envFile = Join-Path $projectRoot ".env.docker"

New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null

$resolvedTargetCredentials = $targetCredentials
if (Test-Path -LiteralPath $targetCredentials) {
  $resolvedTargetCredentials = (Resolve-Path -LiteralPath $targetCredentials).Path
}

if ($credentialsPath.Path -ne $resolvedTargetCredentials) {
  Copy-Item -LiteralPath $credentialsPath -Destination $targetCredentials -Force
}

@"
FRONTEND_IMAGE=$FrontendImage
BACKEND_IMAGE=$BackendImage
FRONTEND_PORT=$FrontendPort
BACKEND_PORT=$BackendPort
GOOGLE_SHEET_ID=$GoogleSheetId
GOOGLE_SHEET_NAME=$GoogleSheetName
GOOGLE_DRIVE_FOLDER_ID=$GoogleDriveFolderId
SYNC_INTERVAL_SECONDS=$SyncIntervalSeconds
LOCAL_DATA_DIR=$LocalDataDir
LOCAL_PHOTO_DIR=$LocalPhotoDir
ALLOWED_ORIGIN=http://localhost:$FrontendPort
"@ | Set-Content -LiteralPath $envFile -Encoding UTF8

Write-Host "Docker configuration prepared."
Write-Host "Env file: $envFile"
Write-Host "Google credentials: $targetCredentials"
Write-Host "Frontend URL: http://localhost:$FrontendPort"

if ($Build -or $Pull -or $Up) {
  Push-Location $projectRoot
  try {
    if ($Build) {
      if ($Up) {
        Invoke-Docker @("compose", "--env-file", ".env.docker", "up", "--build", "-d")
      } else {
        Invoke-Docker @("compose", "--env-file", ".env.docker", "build")
      }
    } elseif ($Up) {
      Invoke-Docker @("compose", "--env-file", ".env.docker", "pull")
      Invoke-Docker @("compose", "--env-file", ".env.docker", "up", "-d", "--no-build", "--force-recreate")
    } elseif ($Pull) {
      Invoke-Docker @("compose", "--env-file", ".env.docker", "pull")
      Write-Host "Images pulled. Run 'docker compose --env-file .env.docker up -d --no-build' to start."
    }
  } finally {
    Pop-Location
  }
}
