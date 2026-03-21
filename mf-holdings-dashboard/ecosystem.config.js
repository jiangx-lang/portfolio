/**
 * PM2 生产配置：在 mf-holdings-dashboard 目录执行
 *   pm2 start ecosystem.config.js
 * 首次部署前请在该目录配置 .env.local（或 export GROQ_API_KEY、SUPABASE_* 等）
 *
 * 若仓库不在 /root/portfolio，请改 apps[0].cwd 或设置环境变量后改用 deploy 脚本里的 DEPLOY_REPO_ROOT。
 */
const path = require("path");

const cwd = path.join(__dirname);

module.exports = {
  apps: [
    {
      name: "atlas-nextjs",
      cwd,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
