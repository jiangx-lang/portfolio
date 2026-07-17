import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Serif_SC, JetBrains_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serifSC = Noto_Serif_SC({
  weight: ["500", "600", "700", "900"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ATLAS · 全资产投研工作台",
    template: "%s · ATLAS",
  },
  description:
    "QDII / MRF / 理财 全资产投研工作台：持仓透视、净值追踪、AI 信号与宏观风险监控。用得越多，解锁越多。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05070D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh"
      className={`${inter.variable} ${serifSC.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <div className="atlas-bg" aria-hidden="true" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
