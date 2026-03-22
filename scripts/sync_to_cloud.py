# -*- coding: utf-8 -*-
"""
将本地 crisis_monitor 输出同步到腾讯云（paramiko + scp）。
解决：Next / Nginx 读云端 HTML 时 figures/ 为空导致页面无图。

【重要】日常请在独立仓库根目录运行官方脚本：
  D:\\fred_crisis_monitor\\sync_to_cloud.py
该脚本用项目相对路径 outputs/crisis_monitor/，并支持 macrolab.env / .env（FRED_CLOUD_*）。
本文件仅为 portfolio 仓内备份/CI 用；未设 CRISIS_LOCAL_OUT 时 Windows 默认指向上述路径。

依赖：
  pip install paramiko scp

环境变量（可选，见下方默认值）：
  SYNC_SSH_HOST   服务器 IP 或域名（必填）
  SYNC_SSH_PORT   默认 22
  SYNC_SSH_USER   默认 root
  SYNC_SSH_KEY    私钥路径，默认 ~/.ssh/id_rsa
  CRISIS_LOCAL_OUT   本地 outputs/crisis_monitor 绝对路径
  CRISIS_REMOTE_OUT  远端目录，须与 Next 读取路径一致，默认 /root/fredmonitor/outputs/crisis_monitor/
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_WIN_DEFAULT = Path(r"D:\fred_crisis_monitor\outputs\crisis_monitor")

try:
    import paramiko
    from scp import SCPClient
except ImportError:
    print("请先安装: pip install paramiko scp", file=sys.stderr)
    sys.exit(1)

SSH_HOST = os.environ.get("SYNC_SSH_HOST", "").strip()
SSH_PORT = int(os.environ.get("SYNC_SSH_PORT", "22"))
SSH_USER = os.environ.get("SYNC_SSH_USER", "root").strip()
SSH_KEY = os.path.expanduser(os.environ.get("SYNC_SSH_KEY", "~/.ssh/id_rsa"))

if sys.platform == "win32":
    _DEFAULT_LOCAL = _WIN_DEFAULT
else:
    _DEFAULT_LOCAL = Path.home() / "fred_crisis_monitor" / "outputs" / "crisis_monitor"

LOCAL_PATH = os.path.expanduser(
    os.environ.get("CRISIS_LOCAL_OUT", str(_DEFAULT_LOCAL))
)
REMOTE_PATH = os.environ.get(
    "CRISIS_REMOTE_OUT", "/root/fredmonitor/outputs/crisis_monitor/"
).strip()
if not REMOTE_PATH.endswith("/"):
    REMOTE_PATH += "/"

# 与网页 / API 消费的文件保持一致；仅当本地存在时才上传
FILES_TO_SYNC = [
    "crisis_report_latest.md",
    "crisis_report_latest.html",
    "crisis_report_latest.json",
    "investigo_signals.json",
]


def _ensure_remote_dir(ssh: paramiko.SSHClient, remote_dir: str) -> None:
    r = remote_dir.rstrip("/")
    stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {repr(r)}")
    stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if err and "File exists" not in err:
        print(f"⚠️ mkdir 提示: {err}")


def main() -> None:
    if not SSH_HOST:
        print("请设置环境变量 SYNC_SSH_HOST", file=sys.stderr)
        sys.exit(1)
    if not os.path.isdir(LOCAL_PATH):
        print(f"本地目录不存在: {LOCAL_PATH}", file=sys.stderr)
        sys.exit(1)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        SSH_HOST,
        port=SSH_PORT,
        username=SSH_USER,
        key_filename=SSH_KEY,
        timeout=30,
    )

    try:
        _ensure_remote_dir(ssh, REMOTE_PATH)

        with SCPClient(ssh.get_transport(), socket_timeout=120) as scp:
            # 1. 同步核心报告与信号文件
            for name in FILES_TO_SYNC:
                local_file = os.path.join(LOCAL_PATH, name)
                if os.path.isfile(local_file):
                    remote_file = REMOTE_PATH + name
                    scp.put(local_file, remote_file)
                    print(f"✅ 已同步: {name}")
                else:
                    print(f"⏭️ 跳过（本地无此文件）: {name}")

            # 2. 递归同步图表目录（网页看图依赖此步）
            local_figures = os.path.join(LOCAL_PATH, "figures")
            if os.path.isdir(local_figures):
                print("🖼️ 正在同步图表文件夹 (figures)...")
                scp.put(local_figures, remote_path=REMOTE_PATH, recursive=True)
                print("✅ 图表同步完成")
            else:
                print("⏭️ 跳过 figures（本地无此目录）")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
