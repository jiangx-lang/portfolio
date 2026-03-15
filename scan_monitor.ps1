# Scan monitor: tail the scan log in real time (run in a separate terminal)
# Usage: .\scan_monitor.ps1   or   .\scan_monitor.ps1 -LogFile "D:\portoflio for mrf\scan_live.txt"
param([string]$LogFile = "scan_live.txt")
$fullPath = Join-Path "D:\portoflio for mrf" $LogFile
if (-not (Test-Path $fullPath)) {
    Write-Host "Log file not found: $fullPath"
    Write-Host "Start the scan first: py -3 sc_fund_parser_qwen_v2.py --dir ..."
    exit 1
}
Write-Host "Monitoring: $fullPath (Ctrl+C to stop)"
Get-Content $fullPath -Wait -Tail 50
