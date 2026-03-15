#!/bin/bash
# start_all.sh — 腾讯云一键启动 MRF + QDII 两个系统
# 用法：chmod +x start_all.sh && ./start_all.sh

PROJECT_DIR="/root/portoflio for mrf"
cd "$PROJECT_DIR" || exit 1

# 停止旧进程
pkill -f "streamlit run app.py" 2>/dev/null
pkill -f "streamlit run qdii_portfolio/app.py" 2>/dev/null
sleep 2

# 启动 MRF（端口 8501）
nohup streamlit run app.py \
    --server.port 8501 \
    --server.address 0.0.0.0 \
    > streamlit_mrf.log 2>&1 &
echo "MRF started (port 8501), PID: $!"

# 启动 QDII（端口 8502）
nohup streamlit run qdii_portfolio/app.py \
    --server.port 8502 \
    --server.address 0.0.0.0 \
    > qdii_portfolio/streamlit_qdii.log 2>&1 &
echo "QDII started (port 8502), PID: $!"

echo "Both systems started."
echo "MRF:  http://43.161.234.75:8501"
echo "QDII: http://43.161.234.75:8502"
echo "Via domain: http://atlasallocations.com (MRF)"
echo "Via domain: http://atlasallocations.com/qdii/ (QDII)"
