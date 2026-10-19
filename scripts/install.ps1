[CmdletBinding()]
param(
  [string]$InstallDir = (Join-Path (Get-Location) "Hello-OS")
)
$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/CodesbyFebin/Hello-OS.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git for Windows, then rerun this script."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required. Install and start Docker Desktop, then rerun this script."
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Compose is required. Enable Compose in Docker Desktop, then rerun this script."
}
if (Test-Path -LiteralPath $InstallDir) {
  throw "Install path already exists: $InstallDir. Choose a new path; this script will not overwrite it."
}

git clone $repoUrl $InstallDir
if ($LASTEXITCODE -ne 0) { throw "Git clone failed." }
Push-Location $InstallDir
try {
  docker compose up --build -d
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed to start HELLO OS." }
} finally {
  Pop-Location
}
Write-Host "HELLO OS is starting. Open http://localhost:3000"
Write-Host "Project directory: $InstallDir"
