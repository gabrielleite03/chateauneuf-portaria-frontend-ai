param(
  [Parameter(Mandatory = $true)]
  [string]$GoogleCredentialsFile,

  [Parameter(Mandatory = $true)]
  [string]$GoogleSheetId,

  [string]$FrontendImage = "gabrielleite03/chateauneuf-portaria-frontend:2026.07.15.6",
  [string]$BackendImage = "gabrielleite03/chateauneuf-portaria-backend:2026.07.15.1",
  [string]$FrontendPort = "8081",
  [string]$FrontendHttpsPort = "8443",
  [string]$BackendPort = "18080",
  [string]$GoogleSheetName = "Entradas",
  [string]$GoogleDriveFolderId = "",
  [string]$LocalDataDir = ".\data",
  [string]$LocalPhotoDir = ".\photos",
  [string]$LocalCertDir = ".\certs",
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

function Join-Bytes {
  param([byte[][]]$Parts)

  $stream = New-Object System.IO.MemoryStream
  foreach ($part in $Parts) {
    $stream.Write($part, 0, $part.Length)
  }
  return $stream.ToArray()
}

function Encode-AsnLength {
  param([int]$Length)

  if ($Length -lt 128) {
    return [byte[]]($Length)
  }

  $bytes = New-Object System.Collections.Generic.List[byte]
  $value = $Length
  while ($value -gt 0) {
    $bytes.Insert(0, [byte]($value -band 0xff))
    $value = $value -shr 8
  }

  $prefix = [byte](0x80 -bor $bytes.Count)
  return [byte[]](@($prefix) + $bytes.ToArray())
}

function Encode-AsnInteger {
  param([byte[]]$Value)

  $start = 0
  while (($start -lt ($Value.Length - 1)) -and ($Value[$start] -eq 0)) {
    $start++
  }

  $normalized = $Value[$start..($Value.Length - 1)]
  if (($normalized[0] -band 0x80) -ne 0) {
    $normalized = [byte[]](@(0) + $normalized)
  }

  return Join-Bytes @([byte[]](0x02), (Encode-AsnLength $normalized.Length), $normalized)
}

function Encode-AsnSequence {
  param([byte[][]]$Children)

  $body = Join-Bytes $Children
  return Join-Bytes @([byte[]](0x30), (Encode-AsnLength $body.Length), $body)
}

function Write-PemFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [byte[]]$Bytes,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $base64 = [Convert]::ToBase64String($Bytes)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("-----BEGIN $Label-----")
  for ($index = 0; $index -lt $base64.Length; $index += 64) {
    $count = [Math]::Min(64, $base64.Length - $index)
    $lines.Add($base64.Substring($index, $count))
  }
  $lines.Add("-----END $Label-----")
  [System.IO.File]::WriteAllText($Path, ($lines -join "`n") + "`n", [System.Text.Encoding]::ASCII)
}

function Resolve-ProjectPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return Join-Path $projectRoot $PathValue
}

function Install-TrustedLocalCertificate {
  param([Parameter(Mandatory = $true)][string]$CertificatePath)

  try {
    & certutil.exe -user -addstore -f Root $CertificatePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "certutil retornou codigo $LASTEXITCODE"
    }
    Write-Host "Certificado localhost instalado como confiavel para o usuario atual."
  } catch {
    Write-Warning "Nao foi possivel instalar o certificado como confiavel automaticamente: $($_.Exception.Message)"
    Write-Warning "Se o Chrome mostrar alerta de certificado, importe manualmente: $CertificatePath"
  }
}

function Ensure-LocalHttpsCertificate {
  $certDir = Resolve-ProjectPath $LocalCertDir
  $certPath = Join-Path $certDir "localhost.crt"
  $keyPath = Join-Path $certDir "localhost.key"

  New-Item -ItemType Directory -Force -Path $certDir | Out-Null

  if ((Test-Path -LiteralPath $certPath -PathType Leaf) -and (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    Write-Host "Certificado HTTPS local encontrado: $certPath"
    return
  }

  Write-Host "Gerando certificado HTTPS local para https://localhost:$FrontendHttpsPort..."

  $rsa = [System.Security.Cryptography.RSA]::Create(2048)
  $request = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
    "CN=localhost",
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  )

  $san = New-Object System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder
  $san.AddDnsName("localhost")
  $san.AddIpAddress([System.Net.IPAddress]::Parse("127.0.0.1"))
  $san.AddIpAddress([System.Net.IPAddress]::Parse("::1"))
  $request.CertificateExtensions.Add($san.Build())
  $request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension($false, $false, 0, $true)))
  $keyUsage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment
  $request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509KeyUsageExtension($keyUsage, $true)))
  $oids = New-Object System.Security.Cryptography.OidCollection
  [void]$oids.Add((New-Object System.Security.Cryptography.Oid("1.3.6.1.5.5.7.3.1")))
  $request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension($oids, $true)))

  $certificate = $request.CreateSelfSigned((Get-Date).AddDays(-1), (Get-Date).AddYears(5))
  Write-PemFile -Label "CERTIFICATE" -Bytes $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert) -Path $certPath

  $parameters = $rsa.ExportParameters($true)
  $privateKey = Encode-AsnSequence @(
    (Encode-AsnInteger ([byte[]](0))),
    (Encode-AsnInteger $parameters.Modulus),
    (Encode-AsnInteger $parameters.Exponent),
    (Encode-AsnInteger $parameters.D),
    (Encode-AsnInteger $parameters.P),
    (Encode-AsnInteger $parameters.Q),
    (Encode-AsnInteger $parameters.DP),
    (Encode-AsnInteger $parameters.DQ),
    (Encode-AsnInteger $parameters.InverseQ)
  )
  Write-PemFile -Label "RSA PRIVATE KEY" -Bytes $privateKey -Path $keyPath

  Install-TrustedLocalCertificate -CertificatePath $certPath
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

Ensure-LocalHttpsCertificate

@"
FRONTEND_IMAGE=$FrontendImage
BACKEND_IMAGE=$BackendImage
FRONTEND_PORT=$FrontendPort
FRONTEND_HTTPS_PORT=$FrontendHttpsPort
BACKEND_PORT=$BackendPort
GOOGLE_SHEET_ID=$GoogleSheetId
GOOGLE_SHEET_NAME=$GoogleSheetName
GOOGLE_DRIVE_FOLDER_ID=$GoogleDriveFolderId
SYNC_INTERVAL_SECONDS=$SyncIntervalSeconds
LOCAL_DATA_DIR=$LocalDataDir
LOCAL_PHOTO_DIR=$LocalPhotoDir
LOCAL_CERT_DIR=$LocalCertDir
ALLOWED_ORIGIN=http://localhost:$FrontendPort
"@ | Set-Content -LiteralPath $envFile -Encoding UTF8

Write-Host "Docker configuration prepared."
Write-Host "Env file: $envFile"
Write-Host "Google credentials: $targetCredentials"
Write-Host "Frontend URL: http://localhost:$FrontendPort"
Write-Host "Frontend HTTPS URL: https://localhost:$FrontendHttpsPort"

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
