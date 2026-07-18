#!/usr/bin/env bash
# 在腾讯云安装「美股编年史」每日同步 cron（对齐 History of Market：美股收盘后刷新）
# 用法：bash scripts/install_chronicle_cron.sh
# 默认：北京时间 工作日 09:00（≈ 美东收盘后次日早晨）

set -euo pipefail

REPO_ROOT="${DEPLOY_REPO_ROOT:-/root/portfolio}"
DASH="${REPO_ROOT}/mf-holdings-dashboard"
LOG_DIR="${REPO_ROOT}/logs"
MARKER="# atlas-chronicle-sync"

mkdir -p "${LOG_DIR}"

CRON_LINE="0 9 * * 2-6 cd ${DASH} && /usr/bin/npm run sync:chronicle >> ${LOG_DIR}/chronicle-sync.log 2>&1 ${MARKER}"

# 去掉旧条目后追加
EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "${EXISTING}" | grep -v "${MARKER}" || true)"
{
  printf '%s\n' "${FILTERED}"
  printf '%s\n' "${CRON_LINE}"
} | crontab -

echo "Installed cron:"
crontab -l | grep "${MARKER}" || true
echo "Log: ${LOG_DIR}/chronicle-sync.log"
echo "Manual run: cd ${DASH} && npm run sync:chronicle"
