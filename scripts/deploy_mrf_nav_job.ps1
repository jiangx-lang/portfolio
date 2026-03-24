param(
  [string]$SshTarget = "root@43.161.234.75",
  [string]$RemoteRoot = "/root/portfolio",
  [string]$RemoteDb = "/root/data/nav_history.db",
  [string]$LocalDownloader = "D:\Mf\backfill_mrf_from_akshare.py",
  [string]$LocalDb = "D:\FinancialData\nav_history.db"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Prepare remote dirs..."
ssh $SshTarget "mkdir -p '$RemoteRoot/scripts' '/root/data' '/root/logs'"

if (-not (Test-Path $LocalDownloader)) {
  throw "[ERR] local downloader not found: $LocalDownloader"
}

Write-Host "[2/4] Upload downloader script..."
scp $LocalDownloader "${SshTarget}:$RemoteRoot/scripts/backfill_mrf_from_akshare.py"

if (Test-Path $LocalDb) {
  Write-Host "[2.5/4] Upload local nav db..."
  scp $LocalDb "${SshTarget}:$RemoteDb"
} else {
  Write-Host "[WARN] local db not found, skip db upload: $LocalDb"
}

Write-Host "[3/4] Install python deps..."
ssh $SshTarget "python3 -m pip install --upgrade pip >/dev/null 2>&1 || true; python3 -m pip install akshare pandas >/dev/null 2>&1 || true"

Write-Host "[4/4] Set cron (daily 00:10 Asia/Shanghai)..."
$cronLine = "10 0 * * * cd $RemoteRoot && NAV_HISTORY_DB=$RemoteDb PYTHONUTF8=1 python3 $RemoteRoot/scripts/backfill_mrf_from_akshare.py >> /root/logs/mrf_nav.log 2>&1"
ssh $SshTarget "crontab -l 2>/dev/null | rg -v 'backfill_mrf_from_akshare.py' > /tmp/cron_mrf_nav || true; echo '$cronLine' >> /tmp/cron_mrf_nav; crontab /tmp/cron_mrf_nav; rm -f /tmp/cron_mrf_nav; crontab -l | rg 'backfill_mrf_from_akshare.py'"

Write-Host "Done."
Write-Host "Manual smoke test command:"
Write-Host "ssh $SshTarget `"cd $RemoteRoot && NAV_HISTORY_DB=$RemoteDb PYTHONUTF8=1 python3 scripts/backfill_mrf_from_akshare.py`""
