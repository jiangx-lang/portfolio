import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "ATLAS Market Portfolio",
  description: "Model Portfolio data",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body
        style={{
          margin: 0,
          background: "#0a0e1a",
          color: "#F9FAFB",
          fontFamily: 'Inter, -apple-system, "PingFang SC", sans-serif',
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
