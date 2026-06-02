$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$taskName = "MCL Overview Screenshot"
$cmdPath = Join-Path $repoRoot "scripts\run-overview-screenshot.cmd"

$taskCommand = "cmd /c `"$cmdPath`""

schtasks /Create /F /TN $taskName /SC HOURLY /MO 2 /TR $taskCommand /RL LIMITED /RU $env:UserName
Write-Host "Task created: $taskName"
