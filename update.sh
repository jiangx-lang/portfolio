#!/bin/bash
# update.sh — 更新代码并重启
# 用法：bash update.sh

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== 更新代码 ==="
git pull origin master

echo "=== 重启服务 ==="
bash start.sh

echo "=== 完成 ==="
