# 本地 / 腾讯云服务 — 日常维护备忘

适用于部署在本地服务器或腾讯云上的 **锦城轮动系统**（Streamlit 应用），服务名：`portfolio`。

---

## 更新代码

拉取最新代码并重启服务（先 stash 本地修改再 pull，避免冲突）：

```bash
cd /home/portfolio && git stash && git pull && systemctl restart portfolio
```

---

## 查看运行状态

```bash
systemctl status portfolio
```

---

## 查看错误日志

最近 50 条日志：

```bash
journalctl -u portfolio -n 50
```

实时跟踪日志：

```bash
journalctl -u portfolio -f
```

---

## 其他常用命令

| 操作       | 命令 |
|------------|------|
| 停止服务   | `sudo systemctl stop portfolio` |
| 启动服务   | `sudo systemctl start portfolio` |
| 重启服务   | `sudo systemctl restart portfolio` |
| 开机自启   | `sudo systemctl enable portfolio` |
| 禁用自启   | `sudo systemctl disable portfolio` |

---

## 健康检查

使用项目内的 `health_check.sh` 做 VPS 健康检查，输出系统信息、资源、网络、进程与异常，并生成**初步诊断摘要**。适用于 Ubuntu/Debian，建议在服务器上定期执行（如 cron 每日一次）。

### 脚本用途

- 收集主机名、uptime、内核/OS 版本、公网 IP、启动时间等基础信息。
- 查看 CPU、load、内存、swap、磁盘及 inode、可选 iostat。
- 查看网络：网卡、路由、连接数、LISTEN 端口、ping、可选 traceroute，以及网络相关日志。
- 查看 top 进程、高占用进程、系统/内核错误日志、OOM、SSH 登录失败（爆破迹象）。
- 可选检查 xray/v2ray/nginx/docker/sshd 等服务状态。
- 最后根据上述结果自动生成**初步诊断摘要**（如：CPU 高负载、内存/swap 压力、磁盘满、网络丢包、SSH 爆破、OOM、服务异常，或未发现明显异常）。

### quick / full 的区别

| 模式 | 说明 |
|------|------|
| **默认 / `--full`** | 执行全部检查：基础信息、资源、完整网络（含 LISTEN、ss -s、路由测试、网络日志）、进程与异常（top 进程、journalctl 错误、dmesg、OOM、SSH 失败）、可选服务检查，最后诊断摘要。 |
| **`--quick`** | 只做：基础信息、资源使用、网络摘要（ESTABLISHED 数、ping 1.1.1.1 与 8.8.8.8）、初步诊断摘要。适合快速看负载和连通性。 |

### 运行命令示例

```bash
# 默认完整检查，结果同时输出到终端和日志文件
./health_check.sh

# 完整检查（同上）
./health_check.sh --full

# 快速检查
./health_check.sh --quick
```

日志文件名为：`health_report_YYYY-MM-DD_HHMMSS.log`，生成在脚本所在目录。**推荐使用 sudo 运行**，以便完整读取 `journalctl`、`dmesg`、`ss`、`/var/log/auth.log` 等。

### 常见结果如何理解

- **CPU 负载偏高**：load average 持续大于 CPU 核数约 2 倍，可能需排查高 CPU 进程或加配置。
- **内存使用率较高 / swap 压力大**：内存或 swap 使用率超过约 90%/50%，可能触发 OOM 或卡顿，需看 top 内存进程或扩容。
- **磁盘使用率 / inode 偏高**：某分区或 inode 超约 90%，需清理或扩容，否则可能导致写入失败。
- **网络存在严重丢包**：对 1.1.1.1 或 8.8.8.8 ping 出现 100% 丢包，多为网络或防火墙问题。
- **SSH 登录失败记录较多**：`auth.log` 中 Failed password 很多，可能有爆破，建议改端口、用密钥、或加 fail2ban。
- **曾发生 OOM kill**：内核曾因内存不足杀进程，需结合内存/swap 与进程列表排查。
- **服务 xxx 未在运行**：若依赖该服务，需 `systemctl start xxx` 或排查配置。
- **未发现明显异常**：脚本未自动判出问题，仍建议结合报告中的具体数字和日志人工看一眼。

---

## 首次部署参考

- 项目路径：`/home/portfolio`（按实际部署路径修改上述 `cd` 路径）
- 代码来源：`git clone https://github.com/jiangx-lang/portfolio.git`
- 运行方式：`streamlit run app.py --server.port 8501 --server.address 0.0.0.0`
- systemd 服务名：`portfolio`

如需补充 systemd 单元示例或 Nginx 反代配置，可在此文档下新增章节。
