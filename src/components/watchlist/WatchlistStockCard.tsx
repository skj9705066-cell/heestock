"use client";

import { useState, useEffect, useMemo } from "react";
import { Star, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { cn, formatPercent } from "@/lib/utils";
import { WatchlistItem } from "@/lib/watchlist";
import { calcSupportLevels, detectBounce, scoreLabel, scoreColor, type OHLCVPoint } from "@/lib/support-levels";
import { SupportLevelAccordion } from "./SupportLevelAccordion";

interface QuoteData {
  price:         number;
  changePercent: number;
  change:        number;
  currency:      string;
}

interface Props {
  item:     WatchlistItem;
  onRemove: (symbol: string) => void;
}

function fmt(price: number, market: "KR" | "US", currency?: string) {
  if (market === "US") return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("ko-KR") + (currency === "KRW" || !currency ? "원" : " " + currency);
}

export function WatchlistStockCard({ item, onRemove }: Props) {
  const [quote,    setQuote]    = useState<QuoteData | null>(null);
  const [candles,  setCandles]  = useState<OHLCVPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Fetch price + daily candles in parallel
        const [snapRes, candleRes] = await Promise.allSettled([
          fetch(`/api/stock-snapshot?symbol=${item.symbol}&market=${item.market}`),
          fetch(`/api/daily-candles?symbol=${item.symbol}&market=${item.market}&days=130`),
        ]);

        if (cancelled) return;

        if (snapRes.status === "fulfilled" && snapRes.value.ok) {
          const data = await snapRes.value.json();
          setQuote({
            price:         data.quote?.price         ?? 0,
            changePercent: data.quote?.changePercent ?? 0,
            change:        data.quote?.change        ?? 0,
            currency:      data.quote?.currency      ?? (item.market === "KR" ? "KRW" : "USD"),
          });
        }

        if (candleRes.status === "fulfilled" && candleRes.value.ok) {
          const data: OHLCVPoint[] = await candleRes.value.json();
          setCandles(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.warn("[WatchlistStockCard] load failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [item.symbol, item.market]);

  const currentPrice = quote?.price ?? 0;

  const supportLevels = useMemo(
    () => calcSupportLevels(candles, currentPrice),
    [candles, currentPrice],
  );

  const bounce = useMemo(
    () => detectBounce(candles, currentPrice, supportLevels),
    [candles, currentPrice, supportLevels],
  );

  // Nearest support below current price
  const nearestBelow = supportLevels.find(s => s.price < currentPrice * 0.99);
  const distToSupport = nearestBelow && currentPrice
    ? ((currentPrice - nearestBelow.price) / nearestBelow.price * 100)
    : null;

  const handleRemove = () => {
    onRemove(item.symbol);
    toast.success(`${item.name} 관심종목 삭제됨`);
  };

  const isUp = (quote?.changePercent ?? 0) >= 0;

  return (
    <div
      className={cn(
        "card p-4 flex flex-col gap-3 transition-all duration-300",
        bounce.detected && "ring-2 ring-yellow-400 dark:ring-yellow-500 shadow-yellow-100 dark:shadow-yellow-900/20",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</h4>
            {bounce.detected && (
              <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full shrink-0">
                📈 지지선 반등 감지
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.symbol} · {item.market}</p>
        </div>
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-yellow-400 hover:text-yellow-500 shrink-0 ml-2"
          title="관심종목 삭제"
        >
          <Star className="w-4 h-4 fill-current" />
        </button>
      </div>

      {/* Price */}
      {loading ? (
        <div className="flex gap-3 animate-pulse">
          <div className="h-7 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      ) : quote ? (
        <div className="flex items-end gap-3">
          <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {fmt(currentPrice, item.market, quote.currency)}
          </span>
          <span className={cn("text-sm font-semibold font-mono mb-0.5", isUp ? "text-red-500" : "text-blue-500")}>
            {isUp ? "▲" : "▼"} {formatPercent(Math.abs(quote.changePercent))}
          </span>
        </div>
      ) : (
        <p className="text-sm text-slate-400">가격 불러오기 실패</p>
      )}

      {/* Nearest support */}
      {nearestBelow && currentPrice ? (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">가장 가까운 지지선</span>
            <span className="text-xs text-slate-400 tabular-nums">
              {distToSupport !== null ? `+${distToSupport.toFixed(1)}% 위` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {fmt(nearestBelow.price, item.market)}
            </span>
            <span className={cn("text-xs font-semibold", scoreColor(nearestBelow.score))}>
              {"⭐".repeat(nearestBelow.score)}
            </span>
            <span className={cn("text-xs", scoreColor(nearestBelow.score))}>
              {nearestBelow.score}/4
            </span>
          </div>
        </div>
      ) : !loading && candles.length > 20 ? (
        <p className="text-xs text-slate-400">현재가 아래 지지선 없음</p>
      ) : !loading ? null : null}

      {/* Toggle button */}
      {candles.length > 20 && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            지지선 분석 보기
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}

      {/* Accordion */}
      {expanded && (
        <SupportLevelAccordion
          levels={supportLevels}
          currentPrice={currentPrice}
          market={item.market}
        />
      )}
    </div>
  );
}
