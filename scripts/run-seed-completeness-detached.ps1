# 완결성 검사 + 갭필 (자리 비워도 계속)
# powershell -ExecutionPolicy Bypass -File scripts\run-seed-completeness-detached.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$log = Join-Path $root 'seed-completeness.log'
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$existing = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'seed-completeness\.ts|seed-resume\.ts|src[/\\]seed[/\\]seed\.ts') }
if ($existing) {
  Write-Host "[audit] another seed running (PID $($existing.ProcessId -join ', ')). stop it first."
  exit 1
}

Add-Content -Path $log -Value "`n===== completeness start $stamp =====`n" -Encoding UTF8
$inner = "cd /d `"$backend`" && npm run seed:completeness >> `"$log`" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $inner -WindowStyle Hidden `
  -WorkingDirectory $backend

Start-Sleep -Seconds 5
$alive = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'seed-completeness\.ts') }
if ($alive) {
  Write-Host "[audit] started. PIDs: $($alive.ProcessId -join ', '). log: $log"
} else {
  Write-Host "[audit] start requested; check log: $log"
}
