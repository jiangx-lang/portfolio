#!/bin/bash
export SUPABASE_URL="https://wpsiqvbhxhzrynfhbwno.supabase.co"
export SUPABASE_KEY="sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz"
cd /root/portfolio
nohup streamlit run app.py --server.port 8501 --server.address 0.0.0.0 &
