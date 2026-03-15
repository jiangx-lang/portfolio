# 全量扫描 + 遇新 pending 即停，便于添加/确认后再次运行断点继续
# 用法: .\run_full_scan_with_pause.ps1
# 另一终端: .\scan_monitor.ps1 观测 scan_live.txt
$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:QWEN_API_KEY = "sk-b3953acb311d4357952a0b38705d17d3"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUNBUFFERED = "1"
Set-Location "D:\portoflio for mrf"
$logFile = "scan_live.txt"
"Scan (pause-on-new-pending) started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $logFile -Encoding utf8
py -3 sc_fund_parser_qwen_v2.py --dir "D:\portoflio for mrf\sc_funds_pdf_v2" --pause-on-new-pending 2>&1 | Tee-Object -FilePath $logFile -Append
"Scan (pause) finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $logFile -Append -Encoding utf8
