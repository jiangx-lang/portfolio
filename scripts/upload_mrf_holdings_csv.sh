#!/usr/bin/env bash
# 将 MRF 持仓 CSV 上传到服务器（与仓库根目录结构一致）
# 用法：
#   chmod +x scripts/upload_mrf_holdings_csv.sh
#   export SSH_TARGET=root@43.161.234.75
#   export REMOTE_ROOT=/root/portfolio   # 可选，默认如此
#   bash scripts/upload_mrf_holdings_csv.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_ROOT="${REMOTE_ROOT:-/root/portfolio}"
SSH_TARGET="${SSH_TARGET:-root@43.161.234.75}"

CSV1="$REPO_ROOT/all_mrf_holdings.csv"
CSV2="$REPO_ROOT/data/mrf_top10_holdings.csv"
[[ -f "$CSV1" ]] || { echo "找不到 $CSV1"; exit 1; }
[[ -f "$CSV2" ]] || { echo "找不到 $CSV2"; exit 1; }

REMOTE_DATA="${REMOTE_ROOT%/}/data"
echo "上传 -> ${SSH_TARGET}:$REMOTE_ROOT/"
scp "$CSV1" "${SSH_TARGET}:$REMOTE_ROOT/"
echo "确保远程目录存在并上传第二个文件 -> ${SSH_TARGET}:$REMOTE_DATA/"
ssh "$SSH_TARGET" "mkdir -p \"$REMOTE_DATA\""
scp "$CSV2" "${SSH_TARGET}:$REMOTE_DATA/"
echo "完成。"
