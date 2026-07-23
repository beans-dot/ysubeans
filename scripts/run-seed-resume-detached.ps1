# 끊긴 시딩 이어하기 (전체 재시딩 아님)
# powershell -ExecutionPolicy Bypass -File scripts\run-seed-resume-detached.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$log = Join-Path $root 'seed-resume.log'
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$existing = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'seed-resume\.ts|seed\.ts') }
if ($existing) {
  Write-Host "[resume] seed already running (PID $($existing.ProcessId -join ', ')). stop it first or wait."
  exit 1
}

Add-Content -Path $log -Value "`n===== resume start $stamp =====`n" -Encoding UTF8
$inner = "cd /d `"$backend`" && npm run seed:resume >> `"$log`" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $inner -WindowStyle Hidden `
  -WorkingDirectory $backend

Start-Sleep -Seconds 4
$alive = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'seed-resume\.ts') }
if ($alive) {
  Write-Host "[resume] started. PIDs: $($alive.ProcessId -join ', '). log: $log"
} else {
  Write-Host "[resume] start requested; check log: $log"
}
