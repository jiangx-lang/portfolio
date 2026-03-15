# Full scan: all PDFs in sc_funds_pdf_v2, output to scan_live.txt for monitoring
# Run: .\run_full_scan.ps1
$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:QWEN_API_KEY = "sk-b3953acb311d4357952a0b38705d17d3"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUNBUFFERED = "1"
Set-Location "D:\portoflio for mrf"
$logFile = "scan_live.txt"
"Scan started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $logFile -Encoding utf8
py -3 sc_fund_parser_qwen_v2.py --dir "D:\portoflio for mrf\sc_funds_pdf_v2" 2>&1 | Tee-Object -FilePath $logFile -Append
"Scan finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $logFile -Append -Encoding utf8
