# 美股编年史（History of Market 镜像）

站内路由：`/chronicle`  
数据同源：https://historyofmarket.com （CC-BY-4.0，须署名）

## 自动更新（与原站同频思路）

原站在美股收盘后刷新 JSON。本站采用：

1. **腾讯云 cron（主路径）**  
   部署脚本会尝试安装：北京时间 **工作日 09:00** 执行 `npm run sync:chronicle`  
   手动安装：
   ```bash
   bash /root/portfolio/scripts/install_chronicle_cron.sh
   cd /root/portfolio/mf-holdings-dashboard && npm run sync:chronicle
   ```
   日志：`/root/portfolio/logs/chronicle-sync.log`

2. **运行时回源**  
   若本地镜像缺失，或 `_sync_meta.json` 超过约 **26 小时**，页面/API 自动拉取官网最新 JSON。

3. **可选手动触发 API**  
   设置环境变量 `CHRONICLE_SYNC_SECRET` 后：
   ```bash
   curl -X POST https://atlasallocations.com/api/chronicle/sync \
     -H "x-chronicle-sync-secret: $CHRONICLE_SYNC_SECRET"
   ```
   状态查询：`GET /api/chronicle/sync`

4. **GitHub Actions**  
   `.github/workflows/chronicle_upstream_health.yml` 工作日探测上游 manifest/profile 是否健康（不落盘大文件）。

## 本地开发

```bash
cd mf-holdings-dashboard
npm run sync:chronicle          # 全量 92 数据集
npm run sync:chronicle:fast     # 更高并发
npm run dev
# 打开 /chronicle
```

数据目录：`public/chronicle-data/`（已 gitignore，勿提交）。
