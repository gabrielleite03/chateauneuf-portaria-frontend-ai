param(
  [Parameter(Mandatory = $true)]
  [string]$GoogleSheetId,

  [string]$InstallDir = "C:\ChateauneufPortaria",
  [string]$SourceDir = "",
  [string]$PackageFile = "chateauneuf-docker-setup.zip",
  [string]$FrontendImage = "gabrielleite03/chateauneuf-portaria-frontend:latest",
  [string]$BackendImage = "gabrielleite03/chateauneuf-portaria-backend:latest",
  [string]$FrontendPort = "8081",
  [string]$BackendPort = "18080",
  [string]$GoogleSheetName = "Entradas",
  [string]$SyncIntervalSeconds = "30",
  [switch]$NoStart,
  [switch]$SkipDockerInstall
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SourceDir)) {
  $SourceDir = $PSScriptRoot
}

function Add-DockerToSessionPath {
  $dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
  if ((Test-Path -LiteralPath (Join-Path $dockerBin "docker.exe")) -and ($env:Path -notlike "*$dockerBin*")) {
    $env:Path = "$dockerBin;$env:Path"
  }
}

function Test-DockerCli {
  Add-DockerToSessionPath
  return $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
}

function Install-DockerDesktop {
  if ($SkipDockerInstall) {
    throw "Docker nao encontrado. Instale o Docker Desktop manualmente ou execute sem -SkipDockerInstall."
  }

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($null -eq $winget) {
    throw "Docker nao encontrado e winget nao esta disponivel. Instale o Docker Desktop manualmente."
  }

  Write-Host "Docker nao encontrado. Instalando Docker Desktop via winget..."
  & winget install --id Docker.DockerDesktop --exact --source winget --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar Docker Desktop via winget. Codigo de saida: $LASTEXITCODE"
  }

  Add-DockerToSessionPath
  if (-not (Test-DockerCli)) {
    throw "Docker Desktop foi instalado, mas o comando docker ainda nao esta disponivel nesta sessao. Reabra o terminal e execute novamente."
  }
}

function Start-DockerDesktop {
  $dockerDesktopPaths = @(
    "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )

  foreach ($dockerDesktopPath in $dockerDesktopPaths) {
    if (Test-Path -LiteralPath $dockerDesktopPath -PathType Leaf) {
      Write-Host "Iniciando Docker Desktop..."
      Start-Process -FilePath $dockerDesktopPath -WindowStyle Hidden
      return
    }
  }
}

function Test-DockerEngine {
  & docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Ensure-DockerReady {
  if (-not (Test-DockerCli)) {
    Install-DockerDesktop
  }

  if (Test-DockerEngine) {
    return
  }

  Start-DockerDesktop

  Write-Host "Aguardando Docker Desktop iniciar..."
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 5
    if (Test-DockerEngine) {
      Write-Host "Docker Desktop pronto."
      return
    }
  } while ((Get-Date) -lt $deadline)

  throw "Docker Desktop foi encontrado, mas o engine nao iniciou. Abra o Docker Desktop, aguarde ficar pronto e execute novamente."
}

function Copy-DistributionFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FileName
  )

  $sourcePath = Join-Path $SourceDir $FileName
  $targetPath = Join-Path $InstallDir $FileName

  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Arquivo obrigatorio nao encontrado: $sourcePath"
  }

  $resolvedSource = (Resolve-Path -LiteralPath $sourcePath).Path
  $resolvedTarget = $targetPath
  if (Test-Path -LiteralPath $targetPath) {
    $resolvedTarget = (Resolve-Path -LiteralPath $targetPath).Path
  }

  if ($resolvedSource -ne $resolvedTarget) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  }
}

$packageName = Split-Path -Leaf $PackageFile
if ([string]::IsNullOrWhiteSpace($packageName)) {
  throw "Informe um nome de ZIP valido em -PackageFile."
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

if (-not $NoStart) {
  Ensure-DockerReady
}

Copy-DistributionFile -FileName "docker-compose.yml"
Copy-DistributionFile -FileName ".env.docker.example"

$sourcePackagePath = Join-Path $SourceDir $packageName
$sourceHasPackage = Test-Path -LiteralPath $sourcePackagePath -PathType Leaf
$sourceIsExtractedPackage = (
  (Test-Path -LiteralPath (Join-Path $SourceDir "scripts\setup-docker.ps1") -PathType Leaf) -and
  (Test-Path -LiteralPath (Join-Path $SourceDir "secrets\google-service-account.json") -PathType Leaf)
)

if ($sourceHasPackage) {
  Copy-DistributionFile -FileName $packageName
} elseif ($sourceIsExtractedPackage) {
  Copy-Item -LiteralPath (Join-Path $SourceDir "scripts") -Destination $InstallDir -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $SourceDir "secrets") -Destination $InstallDir -Recurse -Force
} else {
  throw "Nao encontrei $packageName nem um pacote extraido valido em: $SourceDir"
}

Push-Location $InstallDir
try {
  if ($sourceHasPackage) {
    Expand-Archive ".\$packageName" -DestinationPath . -Force
  }

  $setupScript = Join-Path $InstallDir "scripts\setup-docker.ps1"
  $credentialsFile = Join-Path $InstallDir "secrets\google-service-account.json"

  if (-not (Test-Path -LiteralPath $setupScript -PathType Leaf)) {
    throw "Script de configuracao nao encontrado apos extrair o ZIP: $setupScript"
  }

  if (-not (Test-Path -LiteralPath $credentialsFile -PathType Leaf)) {
    throw "Credencial Google nao encontrada apos extrair o ZIP: $credentialsFile"
  }

  $setupArgs = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $setupScript,
    "-GoogleCredentialsFile", $credentialsFile,
    "-GoogleSheetId", $GoogleSheetId,
    "-FrontendImage", $FrontendImage,
    "-BackendImage", $BackendImage,
    "-FrontendPort", $FrontendPort,
    "-BackendPort", $BackendPort,
    "-GoogleSheetName", $GoogleSheetName,
    "-SyncIntervalSeconds", $SyncIntervalSeconds
  )

  if (-not $NoStart) {
    $setupArgs += "-Up"
  }

  & powershell.exe @setupArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar scripts\setup-docker.ps1. Codigo de saida: $LASTEXITCODE"
  }

  Write-Host ""
  Write-Host "Instalacao preparada em: $InstallDir"
  Write-Host "Aplicacao: http://localhost:$FrontendPort"
  Write-Host ""
  Write-Host "Verificar containers:"
  Write-Host "  docker compose --env-file .env.docker ps"
  Write-Host ""
  Write-Host "Ver logs:"
  Write-Host "  docker compose --env-file .env.docker logs -f"
  Write-Host ""
  Write-Host "Parar:"
  Write-Host "  docker compose --env-file .env.docker down"
  Write-Host ""
  Write-Host "Subir novamente:"
  Write-Host "  docker compose --env-file .env.docker up -d"
} finally {
  Pop-Location
}
