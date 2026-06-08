"use client";

import { useState, useEffect } from "react";
import { Bell, TrendingUp, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import { WatchlistItem } from "@/lib/watchlist";
import { calcSupportLevels, detectBounce, type OHLCVPoint, type BounceSignal } from "@/lib/support-levels";
import toast from "react-hot-toast";

interface BounceAlert {
  item:   WatchlistItem;
  bounce: BounceSignal;
  price:  number;
  changePercent: number;
}

interface Props {
  watchlist: WatchlistItem[];
}

export function BounceAlertsSection({ watchlist }: Props) {
  const [alerts, setAlerts] = useState<BounceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Load expansion state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("heestock_bounce_alerts_expanded");
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, []);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem("heestock_bounce_alerts_expanded", String(newState));
  };

  useEffect(() => {
    if (!watchlist.length) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function scanWatchlist() {
      const results: BounceAlert[] = [];

      await Promise.all(
        watchlist.map(async (item) => {
          try {
            const [snapRes, candleRes] = await Promise.allSettled([
              fetch(`/api/stock-snapshot?symbol=${item.symbol}&market=${item.market}`, {
                cache: "no-store",
                headers: { "Cache-Control": "no-cache" },
              }),
              fetch(`/api/daily-candles?symbol=${item.symbol}&market=${item.market}&days=130`, {
                cache: "no-store",
              }),
            ]);

            if (cancelled) return;

            let price = 0;
            let changePercent = 0;

            if (snapRes.status === "fulfilled" && snapRes.value.ok) {
              const data = await snapRes.value.json();
              price = data.quote?.price ?? 0;
              changePercent = data.quote?.changePercent ?? 0;
            }

            if (candleRes.status === "fulfilled" && candleRes.value.ok) {
              const candles: OHLCVPoint[] = await candleRes.value.json();
              if (!Array.isArray(candles) || candles.length < 20 || !price) return;

              const supportLevels = calcSupportLevels(candles, price);
              const bounce = detectBounce(candles, price, supportLevels);

              if (bounce.detected) {
                results.push({ item, bounce, price, changePercent });
              }
            }
          } catch (e) {
            console.warn("[BounceAlertsSection] scan failed for", item.symbol, e);
          }
        })
      );

      if (!cancelled) {
        setAlerts(results.sort((a, b) => (b.bounce.strength === "강" ? 1 : 0) - (a.bounce.strength === "강" ? 1 : 0)));
        setLoading(false);

        // 브라우저 알림 발송
        if (results.length > 0 && notificationPermission === "granted") {
          sendBrowserNotification(results);
        }
      }
    }

    scanWatchlist();
    return () => { cancelled = true; };
  }, [watchlist, notificationPermission]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("이 브라우저는 알림을 지원하지 않습니다");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      toast.success("알림 권한이 허용되었습니다");
    } else {
      toast.error("알림 권한이 거부되었습니다");
    }
  };

  const sendBrowserNotification = (alerts: BounceAlert[]) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const count = alerts.length;
    const title = count === 1 ? alerts[0].item.name : `${count}개 종목`;
    const body = count === 1
      ? `${alerts[0].bounce.reason} · 강도: ${alerts[0].bounce.strength}`
      : `관심종목 중 ${count}개에서 지지선 반등 신호 감지`;

    new Notification(`🔔 지지선 반등 알림 - ${title}`, {
      body,
      icon: "/icon-192x192.png",
      tag: "bounce-alert",
      requireInteraction: false,
    });
  };

  if (loading) {
    return (
      <section>
        <button
          onClick={toggleExpanded}
          className="flex items-center justify-between w-full mb-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-yellow-500 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">🔔 지지선 반등 알림</h2>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          )}
        </button>
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="card p-6 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-yellow-500 rounded-full animate-spin" />
              관심종목 스캔 중...
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (alerts.length === 0) {
    return (
      <section>
        <button
          onClick={toggleExpanded}
          className="flex items-center justify-between w-full mb-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">🔔 지지선 반등 알림</h2>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          )}
        </button>
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="card p-8 text-center">
            <Bell className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
              현재 지지선 반등 신호가 있는 관심종목이 없습니다
            </p>
            <p className="text-xs text-slate-400">
              관심종목에 담긴 종목 중 반등 조건을 만족하면 여기에 표시됩니다
            </p>
            {notificationPermission !== "granted" && (
              <button
                onClick={requestNotificationPermission}
                className="mt-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                🔔 브라우저 알림 허용하기
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full mb-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-yellow-500 fill-current animate-pulse" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">🔔 지지선 반등 알림</h2>
          <span className="px-2.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full">
            {alerts.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {notificationPermission !== "granted" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                requestNotificationPermission();
              }}
              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              알림 켜기
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          )}
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {alerts.map(({ item, bounce, price, changePercent }) => (
            <BounceAlertCard
              key={item.symbol}
              item={item}
              bounce={bounce}
              price={price}
              changePercent={changePercent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface CardProps {
  item:          WatchlistItem;
  bounce:        BounceSignal;
  price:         number;
  changePercent: number;
}

function BounceAlertCard({ item, bounce, price, changePercent }: CardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isUp = changePercent >= 0;

  const fmt = (p: number) => {
    if (item.market === "US") return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return p.toLocaleString("ko-KR") + "원";
  };

  return (
    <div
      className={cn(
        "card p-4 relative border-2 transition-all duration-300",
        bounce.strength === "강"
          ? "border-red-400 bg-red-50/50 dark:bg-red-900/10 shadow-lg shadow-red-100 dark:shadow-red-900/20"
          : "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10 shadow-lg shadow-yellow-100 dark:shadow-yellow-900/20"
      )}
    >
      {/* Dismiss button */}
      <button
        onClick={() => {
          setDismissed(true);
          toast.success("알림 숨김 처리됨");
        }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600"
        title="알림 닫기"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-green-500" />
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full",
              bounce.strength === "강"
                ? "bg-red-500 text-white"
                : "bg-yellow-500 text-white"
            )}
          >
            반등 {bounce.strength}
          </span>
        </div>
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{item.name}</h3>
        <p className="text-xs text-slate-400 font-mono">{item.symbol} · {item.market}</p>
      </div>

      {/* Price */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {fmt(price)}
          </span>
          <span className={cn("text-sm font-semibold font-mono", isUp ? "text-red-500" : "text-blue-500")}>
            {isUp ? "▲" : "▼"} {formatPercent(Math.abs(changePercent))}
          </span>
        </div>
      </div>

      {/* Support level info */}
      {bounce.nearestSupport && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-3 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">지지선</span>
            <span className="text-xs text-slate-400 tabular-nums">
              {bounce.distancePercent.toFixed(1)}% 아래
            </span>
          </div>
          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {fmt(bounce.nearestSupport.price)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            강도: {bounce.nearestSupport.score}/4
          </div>
        </div>
      )}

      {/* Reason */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {bounce.reason}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          <span>거래량 {bounce.volumeRatio.toFixed(1)}배</span>
          <span>상승 {bounce.todayChangePercent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
