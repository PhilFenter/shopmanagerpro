# Restore the Lovable Cloud dump into a Supabase project you own.
#
# Usage:
#   .\01-restore.ps1 -Backup "C:\path\shopmanagerpro_260731.backup" `
#                    -ConnString "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#
# CONNECTION STRING: use the SESSION POOLER string (port 5432) from
# Supabase -> Project Settings -> Database -> Connection string.
#   - Port 6543 is the TRANSACTION pooler and will NOT work for a restore.
#   - The direct db.<ref>.supabase.co host is IPv6-only on newer projects; the
#     session pooler works over IPv4.
#
# Run order: this script, then 02-post-restore.sql, then the Phase 0 migration
# (supabase/migrations/20260730120000_close_anon_rls_holes.sql), then 03-cron.sql,
# then 04-copy-storage.mjs.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $Backup,
  [Parameter(Mandatory = $true)] [string] $ConnString,
  [string] $PgBin = "C:\Users\Drew\scoop\apps\postgresql\current\bin",
  [switch] $DryRun
)

$ErrorActionPreference = "Stop"
$pgRestore = Join-Path $PgBin "pg_restore.exe"
if (-not (Test-Path $pgRestore)) { throw "pg_restore not found at $pgRestore" }
if (-not (Test-Path $Backup))    { throw "backup not found at $Backup" }

$logDir = Join-Path (Split-Path $Backup -Parent) "restore-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Invoke-Restore {
  param([string] $Label, [string[]] $ExtraArgs)

  # --no-owner  : the dump's owners (supabase_admin, postgres) differ per project
  # --no-acl    : the dump's grants reference Lovable-only roles
  #               (sandbox_exec_cwwkkhcpbswvwghxbfgg, dashboard_user).
  #               02-post-restore.sql re-grants properly. Do not skip that file.
  $args = @("--no-owner", "--no-acl", "--verbose", "--dbname", $ConnString) + $ExtraArgs + @($Backup)

  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  if ($DryRun) { Write-Host "DRY RUN: pg_restore $($args -join ' ')"; return }

  $log = Join-Path $logDir "$Label.log"

  # pg_restore --verbose writes progress to stderr. In Windows PowerShell 5.1 a
  # native command's stderr is wrapped in ErrorRecords, which with
  # ErrorActionPreference = Stop aborts the script on ordinary progress output.
  # Drop to Continue for the duration of the call and judge success by the log
  # and exit code instead.
  $prevEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $pgRestore @args 2>&1 | Out-File -FilePath $log -Encoding utf8
  $exit = $LASTEXITCODE
  $ErrorActionPreference = $prevEAP

  if ($exit -ne 0) { Write-Host "  pg_restore exit code $exit" -ForegroundColor Yellow }

  $errors = Select-String -Path $log -Pattern "^pg_restore: error" -ErrorAction SilentlyContinue
  if ($errors) {
    Write-Host "  $($errors.Count) error line(s) -> $log" -ForegroundColor Yellow
    $errors | Select-Object -First 10 | ForEach-Object { Write-Host "    $($_.Line)" -ForegroundColor DarkYellow }
  } else {
    Write-Host "  clean" -ForegroundColor Green
  }
}

# ---------------------------------------------------------------------------
# 0. Record the TOC for reference
# ---------------------------------------------------------------------------
if (-not $DryRun) {
  & $pgRestore -l $Backup | Out-File -Encoding utf8 (Join-Path $logDir "toc.list")
  Write-Host "TOC written to $logDir\toc.list"
}

# ---------------------------------------------------------------------------
# 1. auth data FIRST, users before identities
# ---------------------------------------------------------------------------
# Must precede the public restore. handle_new_user() fires on every auth.users
# insert and creates a profiles row; if public were restored first, those
# trigger-created rows would collide with the restored profiles data on
# profiles_user_id_key.
#
# Two separate passes because auth.identities has an FK to auth.users, and
# within one pg_restore call the TOC is walked in its own order ("identities"
# sorts before "users") — which would fail the FK.
Invoke-Restore -Label "01-auth-users"      -ExtraArgs @("--data-only", "--schema", "auth", "--table", "users")
Invoke-Restore -Label "02-auth-identities" -ExtraArgs @("--data-only", "--schema", "auth", "--table", "identities")

# ---------------------------------------------------------------------------
# 2. public schema, full (structure + data)
# ---------------------------------------------------------------------------
# pg_restore loads data before post-data objects, so triggers and FKs are
# created AFTER the rows land. That is what prevents the fanout storm
# (fanout_handoff_new, fanout_action_item_new, trg_notification_push,
# email_new_action_item) from firing during the import.
Invoke-Restore -Label "03-public" -ExtraArgs @("--schema", "public")

# ---------------------------------------------------------------------------
# 3. storage BUCKETS only — never storage.objects
# ---------------------------------------------------------------------------
# The bucket rows carry the public flag, size limit and MIME allowlist, so they
# are worth restoring. The OBJECT rows are deliberately skipped: nothing in the
# public schema references storage.objects (no FK, no object_id column), and
# re-uploading each file in 04-copy-storage.mjs recreates its row anyway.
# Restoring them first would instead make every upload fail as a duplicate.
Invoke-Restore -Label "04-storage-buckets" -ExtraArgs @("--data-only", "--schema", "storage", "--table", "buckets")

Write-Host @"

Restore finished. Expected-and-harmless errors in the logs:
  - 'extension "X" already exists' / 'must be owner of extension'
  - 'role "supabase_admin" does not exist'
  - 'schema "public" already exists'
Anything mentioning a public.* table, constraint, or index is NOT harmless.

Next, in order:
  1. migration\02-post-restore.sql   (grants — the app is broken without it)
  2. migration\05-storage-policies.sql
  3. migration\04-copy-storage.mjs   (copies the actual files)
  4. migration\06-rewrite-urls.sql
  5. supabase\migrations\20260730120000_close_anon_rls_holes.sql
  6. migration\03-cron.sql
"@ -ForegroundColor Cyan
