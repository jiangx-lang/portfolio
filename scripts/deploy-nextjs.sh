#!/usr/bin/env bash
# 腾讯云 / 自建机：部署 Next.js（Atlas Dashboard）
# 用法：在服务器上 bash scripts/deploy-nextjs.sh
# 可通过环境变量覆盖仓库路径：export DEPLOY_REPO_ROOT=/path/to/portfolio

set -euo pipefail

REPO_ROOT="${DEPLOY_REPO_ROOT:-/root/portfolio}"
DASH="${REPO_ROOT}/mf-holdings-dashboard"

echo "=== 仓库: ${REPO_ROOT} ==="
cd "${REPO_ROOT}"
echo "=== 拉取最新代码 ==="
git pull origin master

echo "=== 安装 Node 依赖 ==="
cd "${DASH}"
npm install

echo "=== 同步 History of Market 公开数据（CC-BY-4.0）==="
npm run sync:chronicle || echo "WARN: chronicle sync failed, runtime will fall back to upstream"

echo "=== 安装编年史日更 cron（若尚未安装）==="
if [ -f "${REPO_ROOT}/scripts/install_chronicle_cron.sh" ]; then
  bash "${REPO_ROOT}/scripts/install_chronicle_cron.sh" || echo "WARN: cron install skipped"
fi

echo "=== 安装 Python 依赖（持仓深度分析）==="
pip3 install -r scripts/requirements-market.txt || pip3 install --break-system-packages -r scripts/requirements-market.txt || echo "WARN: python deps install skipped"

echo "=== 构建 Next.js ==="
npm run build

echo "=== 重启 PM2（ecosystem.config.js）==="
if pm2 describe atlas-nextjs >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --only atlas-nextjs
else
  pm2 start ecosystem.config.js
fi

echo "=== 部署完成 ==="
pm2 status
