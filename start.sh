#!/bin/bash
# start.sh — 腾讯云一键启动
# 用法：bash start.sh

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== 锦城轮动系统启动脚本 ==="
echo "项目目录: $PROJECT_DIR"

# 创建数据目录
mkdir -p /root/data
mkdir -p /root/market_files/pdfs
mkdir -p /root/market_files/podcasts

# 如果腾讯云没有 fund_tagging.db，从项目目录复制初始版本
if [ ! -f "/root/data/fund_tagging.db" ]; then
    if [ -f "$PROJECT_DIR/qdii_portfolio/fund_tagging.db" ]; then
        echo "初始化 fund_tagging.db ..."
        cp "$PROJECT_DIR/qdii_portfolio/fund_tagging.db" /root/data/fund_tagging.db
    else
        echo "警告: fund_tagging.db 不存在，QDII 功能将提示数据库未就绪"
    fi
fi

# 停止旧进程
echo "停止旧进程..."
pkill -f "streamlit run app.py" 2>/dev/null || true
sleep 2

# 安装/更新依赖
echo "更新依赖..."
pip install -r requirements.txt -q

# 启动
echo "启动 Streamlit (端口 8501)..."
nohup streamlit run app.py \
    --server.port 8501 \
    --server.address 0.0.0.0 \
    --server.maxUploadSize 500 \
    > /root/streamlit.log 2>&1 &

PID=$!
echo "启动成功，PID: $PID"
echo "日志: tail -f /root/streamlit.log"
echo "访问: http://43.161.234.75:8501"
echo "域名: http://atlasallocations.com"
