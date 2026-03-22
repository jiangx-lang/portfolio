"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePageTracking } from "@/hooks/usePageTracking";

type NavLink = { label: string; href: string; external?: boolean };

const navLinks: NavLink[] = [
  { label: "Portfolio", href: "/" },
  { label: "QD基金", href: "/qd" },
  { label: "MRF", href: "/mrf" },
  { label: "WMP", href: "/wmp" },
  { label: "市场笔记", href: "/notes" },
  { label: "播客", href: "/podcast" },
  { label: "Risk", href: "/risk" },
];

const BOTTOM_TABS = [
  { href: "/", label: "Portfolio", icon: "📊" },
  { href: "/qd", label: "QD", icon: "📁" },
  { href: "/mrf", label: "MRF", icon: "🏦" },
  { href: "/notes", label: "笔记", icon: "📝" },
  { href: "/risk", label: "Risk", icon: "📈" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile } = useIsMobile();
  const pathname = usePathname() || "/";
  usePageTracking();

  /** 精确匹配或子路径（必须带 / 分隔，避免 /qd 与 /portfolio 等误判） */
  const navActive = (href: string) => {
    if (!href.startsWith("/")) return false;
    if (pathname === href) return true;
    return pathname.startsWith(`${href}/`);
  };

  const bottomPad = isMobile
    ? "calc(56px + env(safe-area-inset-bottom, 0px))"
    : "0px";

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 52,
          background: "rgba(10, 14, 26, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          zIndex: 200,
        }}
      >
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#F9FAFB",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginRight: "auto",
          }}
        >
          <span style={{ color: "#185FA5", fontSize: 18 }}>◆</span>
          ATLAS
          {!isMobile && (
            <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 400, marginLeft: 4 }}>
              Market Portfolio
            </span>
          )}
        </Link>

        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {navLinks.map(({ href, label, external }) =>
              external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    fontSize: 12,
                    color: "#9CA3AF",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    color: navActive(href) ? "#F9FAFB" : "#9CA3AF",
                    background: navActive(href)
                      ? "rgba(255,255,255,0.08)"
                      : "transparent",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Link>
              )
            )}
          </div>
        )}

        {isMobile && (
          <button
            type="button"
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "none",
              border: "none",
              color: "#F9FAFB",
              cursor: "pointer",
              padding: 8,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                display: "block",
                width: 22,
                height: 2,
                background: "#F9FAFB",
                borderRadius: 2,
                transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none",
                transition: "transform 0.2s",
              }}
            />
            <span
              style={{
                display: "block",
                width: 22,
                height: 2,
                background: "#F9FAFB",
                borderRadius: 2,
                opacity: menuOpen ? 0 : 1,
                transition: "opacity 0.2s",
              }}
            />
            <span
              style={{
                display: "block",
                width: 22,
                height: 2,
                background: "#F9FAFB",
                borderRadius: 2,
                transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
        )}
      </nav>

      {isMobile && menuOpen && (
        <>
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              top: 52,
              background: "rgba(0,0,0,0.4)",
              zIndex: 198,
            }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 52,
              left: 0,
              right: 0,
              background: "rgba(10, 14, 26, 0.98)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              zIndex: 199,
              padding: "0.5rem 0",
              maxHeight: "min(70vh, 420px)",
              overflowY: "auto",
            }}
          >
            {navLinks.map(({ href, label, external }) =>
              external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "14px 1.5rem",
                    fontSize: 15,
                    color: "#9CA3AF",
                    textDecoration: "none",
                    borderLeft: "3px solid transparent",
                  }}
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "14px 1.5rem",
                    fontSize: 15,
                    color: navActive(href) ? "#60A5FA" : "#E5E7EB",
                    textDecoration: "none",
                    borderLeft: navActive(href)
                      ? "3px solid #185FA5"
                      : "3px solid transparent",
                    background: navActive(href)
                      ? "rgba(24, 95, 165, 0.08)"
                      : "transparent",
                  }}
                >
                  {label}
                </Link>
              )
            )}
          </div>
        </>
      )}

      <main
        style={{
          paddingTop: 52,
          paddingBottom: bottomPad,
          overflowX: "hidden",
        }}
      >
        {children}
      </main>

      {isMobile && (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "calc(56px + env(safe-area-inset-bottom, 0px))",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            background: "rgba(10, 14, 26, 0.97)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            zIndex: 200,
          }}
        >
          {BOTTOM_TABS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                textDecoration: "none",
                color: navActive(href) ? "#60A5FA" : "#6B7280",
                fontSize: 10,
                paddingTop: 4,
                minHeight: 56,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
