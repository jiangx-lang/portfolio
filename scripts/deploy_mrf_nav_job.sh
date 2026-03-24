#!/usr/bin/env bash
set -euo pipefail

# 用法:
#   bash scripts/deploy_mrf_nav_job.sh [SSH_TARGET] [REMOTE_ROOT] [REMOTE_DB]
# 示例:
#   bash scripts/deploy_mrf_nav_job.sh root@43.161.234.75 /root/portfolio /root/data/nav_history.db
#
# 作用:
# 1) 上传 d:/Mf/backfill_mrf_from_akshare.py 到云端
# 2) 上传本地 nav_history.db（建议先手动确认包含 mrf_nav/mrf_div）
# 3) 安装依赖
# 4) 设置每日定时任务（cron）增量拉取 MRF

SSH_TARGET="${1:-root@43.161.234.75}"
REMOTE_ROOT="${2:-/root/portfolio}"
REMOTE_DB="${3:-/root/data/nav_history.db}"

# Windows 本地的 MRF 下载器与数据库路径（Git Bash / WSL 可访问时）
LOCAL_MRF_DOWNLOADER="${LOCAL_MRF_DOWNLOADER:-/d/Mf/backfill_mrf_from_akshare.py}"
LOCAL_DB="${LOCAL_DB:-/d/FinancialData/nav_history.db}"

if [[ ! -f "${LOCAL_MRF_DOWNLOADER}" ]]; then
  echo "[ERR] local downloader not found: ${LOCAL_MRF_DOWNLOADER}"
  exit 1
fi

if [[ ! -f "${LOCAL_DB}" ]]; then
  echo "[WARN] local db not found: ${LOCAL_DB}"
  echo "       skip db upload; only uploader script will be deployed."
fi

echo "[1/4] Prepare remote dirs..."
ssh "${SSH_TARGET}" "mkdir -p '${REMOTE_ROOT}/scripts' '/root/data' '/root/logs'"

echo "[2/4] Upload downloader script..."
scp "${LOCAL_MRF_DOWNLOADER}" "${SSH_TARGET}:${REMOTE_ROOT}/scripts/backfill_mrf_from_akshare.py"

if [[ -f "${LOCAL_DB}" ]]; then
  echo "[2.5/4] Upload local nav db..."
  scp "${LOCAL_DB}" "${SSH_TARGET}:${REMOTE_DB}"
fi

echo "[3/4] Install python deps..."
ssh "${SSH_TARGET}" "python3 -m pip install --upgrade pip >/dev/null 2>&1 || true; python3 -m pip install akshare pandas >/dev/null 2>&1 || true"

echo "[4/4] Set cron (daily 00:10 Asia/Shanghai)..."
CRON_LINE="10 0 * * * cd ${REMOTE_ROOT} && NAV_HISTORY_DB=${REMOTE_DB} PYTHONUTF8=1 python3 ${REMOTE_ROOT}/scripts/backfill_mrf_from_akshare.py >> /root/logs/mrf_nav.log 2>&1"
ssh "${SSH_TARGET}" "crontab -l 2>/dev/null | rg -v 'backfill_mrf_from_akshare.py' > /tmp/cron_mrf_nav || true; echo \"${CRON_LINE}\" >> /tmp/cron_mrf_nav; crontab /tmp/cron_mrf_nav; rm -f /tmp/cron_mrf_nav; crontab -l | rg 'backfill_mrf_from_akshare.py'"

echo "Done."
echo "Manual smoke test command:"
echo "ssh ${SSH_TARGET} \"cd ${REMOTE_ROOT} && NAV_HISTORY_DB=${REMOTE_DB} PYTHONUTF8=1 python3 scripts/backfill_mrf_from_akshare.py\""
