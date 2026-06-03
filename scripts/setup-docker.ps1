param(
  [Parameter(Mandatory = $true)]
  [string]$GoogleCredentialsFile,

  [Parameter(Mandatory = $true)]
  [string]$GoogleSheetId,

  [string]$FrontendImage = "gabrielleite03/chateauneuf-portaria-frontend:latest",
  [string]$BackendImage = "gabrielleite03/chateauneuf-portaria-backend:latest",
  [string]$FrontendPort = "8081",
  [string]$BackendPort = "8080",
  [string]$GoogleSheetName = "Entradas",
  [string]$SyncIntervalSeconds = "30",
  [switch]$Pull,
  [switch]$Up,
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$credentialsPath = Resolve-Path -LiteralPath $GoogleCredentialsFile
$secretsDir = Join-Path $projectRoot "secrets"
$targetCredentials = Join-Path $secretsDir "google-service-account.json"
$envFile = Join-Path $projectRoot ".env.docker"

New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
Copy-Item -LiteralPath $credentialsPath -Destination $targetCredentials -Force

@"
FRONTEND_IMAGE=$FrontendImage
BACKEND_IMAGE=$BackendImage
FRONTEND_PORT=$FrontendPort
BACKEND_PORT=$BackendPort
GOOGLE_SHEET_ID=$GoogleSheetId
GOOGLE_SHEET_NAME=$GoogleSheetName
SYNC_INTERVAL_SECONDS=$SyncIntervalSeconds
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
        docker compose --env-file .env.docker up --build -d
      } else {
        docker compose --env-file .env.docker build
      }
    } elseif ($Up) {
      docker compose --env-file .env.docker pull
      docker compose --env-file .env.docker up -d --no-build
    } elseif ($Pull) {
      docker compose --env-file .env.docker pull
      Write-Host "Images pulled. Run 'docker compose --env-file .env.docker up -d --no-build' to start."
    }
  } finally {
    Pop-Location
  }
}
