"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BrainCircuit,
  TrendingUp,
  BarChart3,
  Calculator,
  FileBarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "대시보드",
    description: "시장 현황",
  },
  {
    href: "/ai-analysis",
    icon: BrainCircuit,
    label: "AI 종목 분석",
    description: "Claude AI 분석",
  },
  {
    href: "/market-signals",
    icon: TrendingUp,
    label: "시장 신호등",
    description: "추세 추종 신호",
  },
  {
    href: "/rs-ranking",
    icon: BarChart3,
    label: "RS 순위",
    description: "상대강도 랭킹",
  },
  {
    href: "/valuation",
    icon: Calculator,
    label: "밸류에이션",
    description: "가치 평가 분석",
  },
  {
    href: "/financials",
    icon: FileBarChart2,
    label: "재무제표",
    description: "재무 데이터 분석",
  },
  {
    href: "/guide",
    icon: BookOpen,
    label: "사용설명서",
    description: "앱 사용 가이드",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 flex items-center gap-3 px-4 z-40 md:hidden bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-md flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm">희스탁</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "flex flex-col h-full border-r border-slate-200 dark:border-slate-800",
          "bg-white dark:bg-dark-900 transition-all duration-300 ease-in-out z-50 shrink-0",
          // Mobile: fixed overlay, slide in/out
          "fixed inset-y-0 left-0 w-72",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          // Desktop: in-flow, standard collapsed/expanded
          "md:relative md:translate-x-0 md:shadow-none",
          collapsed ? "md:w-16" : "md:w-60",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                희스탁
              </span>
              <span className="text-xs text-blue-500 font-medium">
                HeeStock
              </span>
            </div>
          )}
          {/* Mobile close button */}
          <button
            className="ml-auto md:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setMobileOpen(false)}
            aria-label="메뉴 닫기"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-14 w-6 h-6 bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors z-10"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-slate-500" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {!collapsed && (
            <p className="px-3 pb-2 text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wider">
              메뉴
            </p>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "sidebar-item",
                  isActive && "sidebar-item-active",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                />
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {item.description}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <button
            onClick={toggleTheme}
            className={cn(
              "sidebar-item w-full",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? (theme === "dark" ? "라이트 모드" : "다크 모드") : undefined}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-amber-400 flex-shrink-0" />
            ) : (
              <Moon className="w-5 h-5 text-slate-500 flex-shrink-0" />
            )}
            {!collapsed && (
              <span className="text-sm">
                {theme === "dark" ? "라이트 모드" : "다크 모드"}
              </span>
            )}
          </button>

          {!collapsed && (
            <div className="px-3 pt-2">
              <p className="text-xs text-slate-400 dark:text-slate-600">
                Powered by Claude AI
              </p>
              <p className="text-xs text-slate-300 dark:text-slate-700">
                v0.1.0
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
