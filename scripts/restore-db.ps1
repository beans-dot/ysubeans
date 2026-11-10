# IR 대시보드 데이터베이스를 db\ir_dashboard.sql 로 복원한다.
#
# 다른 PC에 PostgreSQL 16을 설치하고 서비스를 켠 뒤, 이 폴더에서 실행한다.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore-db.ps1
#
# postgres 슈퍼유저 비밀번호만 한 번 있으면 된다.
# 덤프에는 OWNER 와 GRANT 가 없다. 앱 계정으로 SQL을 넣으므로 테이블 주인은 앱 계정이다.
# 받는 PC의 역할 이름을 덤프와 맞출 필요는 없다.

param(
  [string]$SuperUser = "postgres",
  [string]$SuperPassword = $env:POSTGRES_SUPER_PASSWORD
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dump = Join-Path $root "db\ir_dashboard.sql"
if (-not (Test-Path $dump)) {
  throw "덤프 파일이 없습니다: $dump"
}

$tail = Get-Content -Path $dump -Tail 8 -Encoding UTF8
if (($tail -join "`n") -notmatch "PostgreSQL database dump complete") {
  throw "덤프 파일이 끝까지 쓰이지 않았습니다: $dump"
}

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  foreach ($raw in Get-Content -Path $Path -Encoding UTF8) {
    $line = $raw.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $map[$line.Substring(0, $idx).Trim()] = $line.Substring($idx + 1).Trim()
  }
  return $map
}

function Assert-Ident([string]$Name, [string]$Label) {
  if ($Name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "$Label 값 '$Name' 은 영문/숫자/밑줄만 사용할 수 있습니다."
  }
}

# 앱과 같이 backend\.env 가 루트 .env 보다 우선한다.
$cfg = Read-DotEnv (Join-Path $root ".env")
$backendEnv = Read-DotEnv (Join-Path $root "backend\.env")
foreach ($key in $backendEnv.Keys) { $cfg[$key] = $backendEnv[$key] }

$dbHost = if ($cfg["DB_HOST"]) { $cfg["DB_HOST"] } else { "localhost" }
$dbPort = if ($cfg["DB_PORT"]) { $cfg["DB_PORT"] } else { "5432" }
$dbUser = if ($cfg["DB_USERNAME"]) { $cfg["DB_USERNAME"] } else { "ir_user" }
$dbPass = if ($cfg.ContainsKey("DB_PASSWORD")) { $cfg["DB_PASSWORD"] } else { "ir_password" }
$dbName = if ($cfg["DB_DATABASE"]) { $cfg["DB_DATABASE"] } else { "ir_dashboard" }

if ($dbHost -eq "db") {
  throw "DB_HOST=db 는 이 PC의 PostgreSQL이 아닙니다. .env 의 DB_HOST 를 localhost 로 바꾸세요."
}
Assert-Ident $dbUser "DB_USERNAME"
Assert-Ident $dbName "DB_DATABASE"
if (-not $dbPass) { throw ".env 의 DB_PASSWORD 가 비어 있습니다." }

if (-not $SuperPassword) {
  $secure = Read-Host "PostgreSQL 슈퍼유저($SuperUser) 비밀번호" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $SuperPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
if (-not $SuperPassword) { throw "PostgreSQL 슈퍼유저 비밀번호가 필요합니다." }

$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCmd) {
  $psql = $psqlCmd.Source
} else {
  $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $found) {
    throw "psql.exe 를 찾지 못했습니다. PostgreSQL 16을 설치한 뒤 다시 실행하세요."
  }
  $psql = $found.FullName
}

$service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($service -and $service.Status -ne "Running") {
  Write-Host "PostgreSQL 서비스($($service.Name))를 시작합니다."
  Start-Service $service.Name
}

$env:PGPASSWORD = $SuperPassword
$env:PGCLIENTENCODING = "UTF8"
$sqlFile = Join-Path $PSScriptRoot "init-db.sql"
Write-Host "로컬 PostgreSQL ${dbHost}:${dbPort} 에 데이터베이스 '$dbName' / 역할 '$dbUser' 를 준비합니다."
& $psql -h $dbHost -p $dbPort -U $SuperUser -d postgres -v ON_ERROR_STOP=1 `
  -v "app_user=$dbUser" -v "app_password=$dbPass" -v "app_db=$dbName" `
  -f $sqlFile
if ($LASTEXITCODE -ne 0) {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  throw "역할과 데이터베이스를 만들지 못했습니다. 슈퍼유저 비밀번호를 확인하세요."
}

Write-Host "덤프를 앱 계정으로 복원합니다. 기존 테이블이 있으면 지우고 다시 넣습니다."
$env:PGPASSWORD = $dbPass
& $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f $dump
if ($LASTEXITCODE -ne 0) {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  throw "덤프 복원에 실패했습니다."
}

& $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -c @"
SELECT count(*) FILTER (WHERE pg_get_userbyid(c.relowner) = current_user) AS owned_by_app_user,
       count(*) AS tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
"@
if ($LASTEXITCODE -ne 0) {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  throw "복원 결과 확인에 실패했습니다."
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Write-Host "복원되었습니다. 다음으로 npm run install:all 후 npm run dev 를 실행하세요."
