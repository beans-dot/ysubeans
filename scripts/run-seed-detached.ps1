# 자리 비워도 시딩이 계속되도록 독립 프로세스로 실행
# 사용: powershell -ExecutionPolicy Bypass -File scripts\run-seed-detached.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$log = Join-Path $root 'seed-fill.log'
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

# 이미 seed.ts 가 돌면 중복 실행하지 않음
$existing = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'src[/\\]seed[/\\]seed\.ts') }
if ($existing) {
  Write-Host "[seed] already running (PID $($existing.ProcessId -join ', ')). skip."
  exit 0
}

Add-Content -Path $log -Value "`n===== detached seed start $stamp =====`n" -Encoding UTF8

# cmd /c + Start-Process 로 Cursor/에이전트 세션과 분리
$inner = "cd /d `"$backend`" && npm run seed >> `"$log`" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $inner -WindowStyle Hidden `
  -WorkingDirectory $backend

Start-Sleep -Seconds 3
$alive = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'src[/\\]seed[/\\]seed\.ts|npm run seed') }
if ($alive) {
  Write-Host "[seed] started. PIDs: $($alive.ProcessId -join ', '). log: $log"
} else {
  Write-Host "[seed] start requested; check log: $log"
  exit 1
}
