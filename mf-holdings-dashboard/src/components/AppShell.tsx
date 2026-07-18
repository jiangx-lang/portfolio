"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileText,
  Gem,
  Globe,
  Home,
  Landmark,
  Menu,
  X,
} from "lucide-react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { UserProgressBadge } from "@/components/UserProgressBadge";

type NavLink = { label: string; href: string; external?: boolean };

const navLinks: NavLink[] = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "QD基金", href: "/qd" },
  { label: "MRF", href: "/mrf" },
  { label: "理财", href: "/wmp" },
  { label: "编年史", href: "https://historyofmarket.com/", external: true },
  { label: "市场笔记", href: "/notes" },
  { label: "播客", href: "/podcast" },
  { label: "Risk", href: "/risk" },
];

type TabIcon = React.ComponentType<{
  className?: string;
  strokeWidth?: string | number;
}>;

const BOTTOM_TABS: { href: string; label: string; icon: TabIcon }[] = [
  { href: "/", label: "首页", icon: Home },
  { href: "/qd", label: "QD", icon: Globe },
  { href: "/mrf", label: "MRF", icon: Landmark },
  { href: "/notes", label: "笔记", icon: FileText },
  { href: "/risk", label: "Risk", icon: Activity },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() || "/";
  usePageTracking();

  // 滚动后加深导航底部分隔，并点亮金色发丝线
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 登录页不展示壳（顶部导航/底部 tab），避免干扰表单与重定向逻辑
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return <>{children}</>;
  }

  /** 精确匹配或子路径（必须带 / 分隔，避免 /qd 与 /portfolio 等误判） */
  const navActive = (href: string) => {
    if (!href.startsWith("/")) return false;
    if (pathname === href) return true;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[200] h-14 border-b bg-[#05070D]/80 backdrop-blur-xl transition-colors duration-300 md:h-[60px] ${
          scrolled ? "border-white/[0.12]" : "border-white/[0.06]"
        }`}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="mr-auto flex items-center gap-2.5"
          >
            <Gem className="h-4 w-4 text-gold" strokeWidth={1.8} />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-bold tracking-[0.24em] text-gradient-gold">
                ATLAS
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                Market Portfolio
              </span>
            </span>
          </Link>

          {/* 桌面导航 */}
          <nav className="hidden h-full items-stretch md:flex">
            {navLinks.map(({ href, label, external }) =>
              external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex items-center px-3 text-[13px] text-slate-400 whitespace-nowrap transition-colors hover:text-slate-100"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center px-3 text-[13px] whitespace-nowrap transition-colors ${
                    navActive(href)
                      ? "text-gold"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gradient-gold transition-opacity duration-300 ${
                      navActive(href) ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              )
            )}
            <Link
              href="/admin"
              className={`relative flex items-center px-3 text-[13px] whitespace-nowrap transition-colors ${
                navActive("/admin")
                  ? "text-gold"
                  : "text-slate-500 hover:text-slate-100"
              }`}
            >
              管理
              <span
                className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gradient-gold transition-opacity duration-300 ${
                  navActive("/admin") ? "opacity-100" : "opacity-0"
                }`}
              />
            </Link>
          </nav>

          <div className="hidden md:block">
            <UserProgressBadge />
          </div>

          {/* 移动端：紧凑徽章 + 汉堡按钮 */}
          <div className="flex items-center gap-2 md:hidden">
            <UserProgressBadge compact />
            <button
              type="button"
              aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] text-slate-200 transition-colors hover:border-gold/30 hover:text-gold"
            >
              {menuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.8} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>

        {/* 滚动后点亮的金色发丝线 */}
        <div
          className={`absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent transition-opacity duration-300 ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        />
      </header>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <>
          <div
            role="presentation"
            className="fixed inset-0 top-14 z-[190] bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="glass-panel fixed inset-x-4 top-16 z-[195] max-h-[min(70vh,420px)] overflow-y-auto p-2 animate-in md:hidden">
            {navLinks.map(({ href, label, external }) =>
              external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-xl border-l-2 px-4 py-3 text-sm transition-colors ${
                    navActive(href)
                      ? "border-gold bg-gold/[0.08] text-gold"
                      : "border-transparent text-slate-300 hover:bg-white/[0.04] hover:text-slate-100"
                  }`}
                >
                  {label}
                </Link>
              )
            )}
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl border-l-2 border-transparent px-4 py-3 text-sm text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
            >
              管理后台
            </Link>
          </div>
        </>
      )}

      <main className="overflow-x-hidden pt-14 pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pt-[60px] md:pb-0">
        {children}
      </main>

      {/* 移动端底部 tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-[200] border-t border-white/[0.07] bg-[#05070D]/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        <div className="flex h-14">
          {BOTTOM_TABS.map(({ href, label, icon: Icon }) => {
            const active = navActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors ${
                  active ? "text-gold" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  strokeWidth={active ? 2 : 1.6}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
