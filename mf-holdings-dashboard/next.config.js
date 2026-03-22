/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Risk 报告 HTML 内图片改为走本站路径，避免 img-src 'self' 类 CSP 拦截 media 子域。
   * 与 src/app/api/risk-report-html/route.ts 中的 /risk-media/、/risk-media-root/ 前缀一致。
   */
  async rewrites() {
    return [
      {
        source: "/risk-media/:path*",
        destination: "https://media.atlasallocations.com/risk-figures/:path*",
      },
      {
        source: "/risk-media-root/:path*",
        destination:
          "https://media.atlasallocations.com/risk-figures-root/:path*",
      },
    ];
  },
  webpack: (config) => {
    // Windows 上曾出现 .next webpack pack cache 损坏，导致静态资源 404 / 页面白屏。
    // 关闭持久化缓存，优先保证 dev 体验稳定。
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
