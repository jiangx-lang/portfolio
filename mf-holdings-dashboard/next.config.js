/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Windows 上曾出现 .next webpack pack cache 损坏，导致静态资源 404 / 页面白屏。
    // 关闭持久化缓存，优先保证 dev 体验稳定。
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
