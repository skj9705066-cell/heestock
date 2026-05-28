import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { RefreshProvider } from "@/context/RefreshContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { PWARegister } from "@/components/PWARegister";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "희스탁 | AI 주식 분석 플랫폼",
  description: "AI 기반 한국·미국 주식 종합 분석 플랫폼. Claude AI를 활용한 실시간 종목 분석.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "희스탁",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider>
          <RefreshProvider>
            <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-dark-950">
              {/* Spacer for the fixed mobile top bar rendered by Sidebar */}
              <div className="h-14 shrink-0 md:hidden" aria-hidden="true" />
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                className: "!bg-slate-800 !text-slate-100 !border !border-slate-700",
                duration: 3000,
              }}
            />
          </RefreshProvider>
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
