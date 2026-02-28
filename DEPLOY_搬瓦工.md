# 搬瓦工 VPS 部署指南（宏观资产配置引擎）

## 一、把代码传到搬瓦工

### 方式 A：用 Git（推荐，便于以后更新）

**1. 本地先提交并推送到远程仓库**

若你已有 GitHub/Gitee 仓库：

```powershell
cd "d:\portoflio for mrf"
git add app.py
git commit -m "V8: 双端自适应 + 移动端卡片流"
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin master
```

**2. 在搬瓦工上拉代码**

SSH 登录后（把 `root@你的VPS的IP` 换成你的实际信息）：

```bash
# 若还没装 git：apt update && apt install -y git  # Debian/Ubuntu
cd /root   # 或你打算放的目录
git clone https://github.com/你的用户名/你的仓库名.git portoflio
cd portoflio
```

若仓库是私有的，需在 VPS 上配置 SSH key 或凭据。

---

### 方式 B：用 SCP 直接拷（不打算用 Git 时）

在**你本机 PowerShell** 执行（把 `root@1.2.3.4` 换成你的 VPS 用户和 IP）：

```powershell
cd "d:\portoflio for mrf"
scp -r app.py requirements.txt mapping_engine.py optimizer.py run_optimizer.py parsers "root@你的VPS的IP:/root/portoflio/"
```

若没有 `portoflio` 目录，先 SSH 登录 VPS 建目录：

```bash
ssh root@你的VPS的IP
mkdir -p /root/portoflio
exit
```

然后再执行上面的 `scp`。

---

## 二、在搬瓦工上安装环境并运行

**1. SSH 登录**

```bash
ssh root@你的VPS的IP
```

**2. 安装 Python 3 和 pip（若未装）**

```bash
apt update && apt install -y python3 python3-pip python3-venv
```

**3. 进入项目目录并建虚拟环境**

```bash
cd /root/portoflio   # 或你 clone/scp 到的目录
python3 -m venv venv
source venv/bin/activate
```

**4. 安装依赖**

```bash
pip install -r requirements.txt
# 若 requirements 里没有 streamlit：pip install streamlit pandas numpy
```

**5. 后台启动 Streamlit（对外可访问）**

```bash
nohup streamlit run app.py --server.port 8501 --server.address 0.0.0.0 > streamlit.log 2>&1 &
```

- `--server.address 0.0.0.0`：允许外网访问  
- `nohup ... &`：关掉 SSH 后进程继续跑  
- 日志在 `streamlit.log`，排查问题可：`tail -f streamlit.log`

**6. 放行防火墙端口（若 VPS 开了 ufw/iptables）**

```bash
# 若用 ufw
ufw allow 8501/tcp
ufw reload
```

**7. 浏览器访问**

```
http://你的VPS公网IP:8501
```

---

## 三、常用运维命令

| 操作           | 命令 |
|----------------|------|
| 看是否在跑     | `ps aux \| grep streamlit` |
| 停掉           | `pkill -f "streamlit run app.py"` |
| 看最近日志     | `tail -100 /root/portoflio/streamlit.log` |
| 更新代码后重启 | `cd /root/portoflio && git pull && pkill -f "streamlit run" && nohup streamlit run app.py --server.port 8501 --server.address 0.0.0.0 >> streamlit.log 2>&1 &` |

---

## 四、可选：用 systemd 开机自启

创建服务文件：

```bash
nano /etc/systemd/system/streamlit-app.service
```

写入（路径按你实际改）：

```ini
[Unit]
Description=Streamlit 宏观资产配置引擎
After=network.target

[Service]
User=root
WorkingDirectory=/root/portoflio
ExecStart=/root/portoflio/venv/bin/streamlit run app.py --server.port 8501 --server.address 0.0.0.0
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
systemctl daemon-reload
systemctl enable streamlit-app
systemctl start streamlit-app
systemctl status streamlit-app
```

之后更新代码可：`git pull` 或替换文件后执行 `systemctl restart streamlit-app`。
