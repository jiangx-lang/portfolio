# 技术询问：部署架构与访问地址 — 答复

根据项目内代码与文档检索，结论如下。**域名、nginx、腾讯云实际启动方式** 未在仓库中写明，需你按实际环境补充。

---

## 问题 1：MRF 系统的访问地址

### 1.1 `FILE_SERVER_BASE_URL` 默认值

- **位置**：`D:\portoflio for mrf\app.py` 第 37–39 行  
- **默认值**：`http://43.161.234.75:8504`  
- **含义**：这是 **PDF/静态文件服务** 的 base URL（每日报告「查看」打开的链接），**不是** MRF Streamlit 主应用的访问地址。  
- 可通过环境变量覆盖：`FILE_SERVER_BASE_URL`。

### 1.2 `.env` / 环境变量里的域名或 IP

- **项目根** `.env.example` 只有 `QWEN_API_KEY`，没有域名或 IP。  
- **app.py** 里仅有一处写死地址：上述 `FILE_SERVER_BASE_URL` 默认 `43.161.234.75:8504`。  
- 结论：仓库内**没有**用 `.env` 配置 MRF 主应用域名或 IP；若你在服务器上设了 `FILE_SERVER_BASE_URL`，以服务器为准。

### 1.3 腾讯云上 MRF 的启动命令与端口

- **文档**：`DEPLOY_搬瓦工.md`（搬瓦工/VPS 部署，逻辑同样适用于腾讯云）。  
- **命令**：  
  `nohup streamlit run app.py --server.port 8501 --server.address 0.0.0.0 > streamlit.log 2>&1 &`  
- **端口**：**8501**（MRF 主应用）。  
- 同一进程内还会在 **8504** 端口启动静态文件服务（`_start_static_file_server()`），用于提供 PDF，因此：  
  - **MRF 页面**：8501  
  - **PDF 链接**：8504（或你设置的 `FILE_SERVER_BASE_URL`）。

### 1.4 nginx / 反向代理

- 仓库内**没有** `nginx.conf` 或其它反向代理配置。  
- 若腾讯云上用了 nginx，需在服务器上查看实际配置（路径、子域名等）。

---

## 问题 2：QDII 系统的访问地址

### 2.1 腾讯云启动命令与端口（仓库内情况）

- **README** 只写了 **Streamlit Cloud** 部署（连 GitHub，主模块 `qdii_portfolio/app.py`），**没有**写腾讯云上的启动命令或端口。  
- **qdii_portfolio/app.py** 侧栏跳转用的默认值：  
  - `QDII_APP_URL`：`http://localhost:8501`  
  - `MRF_APP_URL`：`http://localhost:8502`  
- 若你把 **QDII 也部署在同一台腾讯云** 上，需要**自己**再起一个进程，例如：  
  `streamlit run qdii_portfolio/app.py --server.port 8502 --server.address 0.0.0.0`  
  此时：  
  - 8501 = MRF  
  - 8502 = QDII  
  当前仓库**没有** `start.sh` / `deploy.sh` 写死这两条命令。

### 2.2 单独域名或 nginx 代理

- 仓库内**没有** QDII 的域名或 nginx 配置。  
- 若 QDII 只部署在 **Streamlit Cloud**，则访问地址为 Streamlit 提供的 URL（如 `https://xxx.streamlit.app`），需在 Secrets 里填 `QDII_APP_URL`。

---

## 问题 3：两个系统是否在同一台腾讯云服务器上？

- 仓库内**没有** `docker-compose.yml`、`start.sh`、`deploy.sh` 等列出多服务的脚本。  
- **DEPLOY_搬瓦工.md** 只描述了**一个**服务：`streamlit run app.py` 占 **8501**。  
- 结论：**从代码无法判断** MRF 和 QDII 是否在同一台机；若你在一台机上同时跑 MRF(8501) + QDII(8502)，需要自己写启动脚本或 systemd 服务。

---

## 问题 4：用户通过什么地址访问？

- **域名**：仓库中**没有**出现你购买的域名（如 jincity.com）。  
- **IP**：仅有一处写死 IP：**43.161.234.75**（`app.py` 里 `FILE_SERVER_BASE_URL` 的默认 host）。  
- **A 记录 / nginx**：需你在服务器和域名 DNS 处确认：  
  - 域名是否 A 记录到 `43.161.234.75`；  
  - nginx 是否用路径或子域名分别反代 8501、8502（或 8504）。

---

## 最终：侧栏跳转应填的 URL（需要你确认的部分）

下面按「**两种常见部署方式**」给出建议，你按实际二选一或改成自己的。

### 情况 A：MRF 与 QDII 都在同一台腾讯云（43.161.234.75），直连端口

- **MRF 系统完整访问 URL**：  
  `http://43.161.234.75:8501`  
  （若做了 nginx 反代且对外只开 80/443，则改为你实际域名，见情况 B。）

- **QDII 系统完整访问 URL**：  
  `http://43.161.234.75:8502`  
  （前提：你已在该机启动 `streamlit run qdii_portfolio/app.py --server.port 8502`。）

- **侧栏配置（Streamlit Secrets 或 .env）**：  
  - `MRF_APP_URL` = `http://43.161.234.75:8501`  
  - `QDII_APP_URL` = `http://43.161.234.75:8502`

### 情况 B：有域名 + nginx，按路径或子域名区分

- 若 nginx 配置为：  
  - `mrf.你的域名.com` → `localhost:8501`  
  - `qdii.你的域名.com` → `localhost:8502`  
则：  
  - **MRF 系统完整访问 URL**：`https://mrf.你的域名.com`  
  - **QDII 系统完整访问 URL**：`https://qdii.你的域名.com`  
  - `MRF_APP_URL` / `QDII_APP_URL` 填上述两个 URL。

### 情况 C：QDII 在 Streamlit Cloud，MRF 在腾讯云

- **QDII 系统完整访问 URL**：Streamlit Cloud 提供的地址，如 `https://xxx.streamlit.app` → 填到 `QDII_APP_URL`。  
- **MRF 系统完整访问 URL**：`http://43.161.234.75:8501` 或你的 nginx 域名（如 `https://mrf.你的域名.com`）→ 填到 `MRF_APP_URL`。

---

## 小结表（需你按实际环境填写）

| 项目           | 仓库内能确定的                 | 需要你确认的                           |
|----------------|--------------------------------|----------------------------------------|
| MRF 主应用端口 | 8501                           | 腾讯云是否真用 8501；是否用 nginx/域名 |
| MRF PDF 服务   | 8504，默认 URL 含 43.161.234.75 | 是否改过 `FILE_SERVER_BASE_URL`        |
| QDII 端口      | 无默认；本地演示用 8501        | 腾讯云是否跑 QDII、端口是否 8502       |
| 域名           | 无                             | 是否 A 到 43.161.234.75；nginx 路径/子域名 |
| 同机多服务     | 无脚本                         | 是否同机、是否需自写 start/deploy 脚本 |

把上面「需要你确认的」填好后，把最终选定的 **MRF 完整 URL** 和 **QDII 完整 URL** 填入 `qdii_portfolio` 侧栏所用的 Secrets（或部署环境变量）：  
`MRF_APP_URL`、`QDII_APP_URL` 即可。
