# Upload two MRF CSV files to server.
# Usage:
#   cd "d:\portoflio for mrf\scripts"
#   .\upload_mrf_holdings_csv.ps1
#   # optional override:
#   .\upload_mrf_holdings_csv.ps1 -SshTarget root@your.server.ip -RemoteRoot /root/portfolio

param(
  [Parameter(Mandatory = $false, HelpMessage = "Default root@43.161.234.75")]
  [string] $SshTarget = "root@43.161.234.75",
  [string] $RemoteRoot = "/root/portfolio"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Csv1 = Join-Path $RepoRoot "all_mrf_holdings.csv"
$Csv2 = Join-Path $RepoRoot "data\mrf_top10_holdings.csv"

if (-not (Test-Path -LiteralPath $Csv1)) { throw "Missing file: $Csv1" }
if (-not (Test-Path -LiteralPath $Csv2)) { throw "Missing file: $Csv2" }

$remoteData = ($RemoteRoot.TrimEnd("/") + "/data")
Write-Host "Uploading -> ${SshTarget}:$RemoteRoot/ ..."
scp $Csv1 "${SshTarget}:$RemoteRoot/"
Write-Host "Uploading -> ${SshTarget}:$remoteData/ ..."
ssh $SshTarget "mkdir -p `"$remoteData`""
scp $Csv2 "${SshTarget}:$remoteData/"
Write-Host "Done."
