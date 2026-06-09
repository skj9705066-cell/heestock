"use client";

import { useState, useEffect, useMemo } from "react";
import { Star, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { cn, formatPercent } from "@/lib/utils";
import { WatchlistItem } from "@/lib/watchlist";
import { calcSupportLevels, detectBounce, type OHLCVPoint, type SupportLevel } from "@/lib/support-levels";
import { fetchSnapshot, fetchCandles } from "@/lib/request-queue";

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

function scoreEmoji(score: number): string {
  if (score >= 3) return "🔴";
  if (score === 2) return "🟡";
  return "⚪";
}

function scoreColor(score: number): string {
  if (score >= 3) return "text-red-500";
  if (score === 2) return "text-yellow-500";
  return "text-slate-400";
}

export function WatchlistStockCard({ item, onRemove }: Props) {
  const [quote,    setQuote]    = useState<QuoteData | null>(null);
  const [candles,  setCandles]  = useState<OHLCVPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // 종목코드 정규화 + market 강제 재판별:
  // localStorage의 market 값이 오염(KR 종목인데 "US")돼 있어도, 6자리 숫자 코드면
  // 항상 KR로 조회한다. AI 종목 분석과 동일하게 올바른 시장으로 시세를 가져오기 위함.
  const symbol = useMemo(
    () => String(item.symbol).replace(/\.(KS|KQ)$/i, ""),
    [item.symbol],
  );
  const market: "KR" | "US" = /^\d{6}$/.test(symbol) ? "KR" : item.market;

  useEffect(() => {
    let cancelled = false;

    async function load(attempt: number) {
      if (attempt === 0) setLoading(true);
      try {
        // 동시성 제한 + 중복제거 큐 경유. 같은 종목은 바운스알림/다른 카드와 호출을 공유.
        const [snap, candleData] = await Promise.all([
          fetchSnapshot(symbol, market),
          fetchCandles(symbol, market, 130),
        ]);

        if (cancelled) return;

        if (Array.isArray(candleData)) {
          setCandles(candleData as OHLCVPoint[]);
        }

        let priceOk = false;
        const price = snap?.quote?.price ?? 0;
        if (price > 0) {
          setQuote({
            price,
            changePercent: snap!.quote!.changePercent ?? 0,
            change:        snap!.quote!.change        ?? 0,
            currency:      snap!.quote!.currency       ?? (market === "KR" ? "KRW" : "USD"),
          });
          priceOk = true;
        }

        if (priceOk) { setLoading(false); return; }

        // quote 누락(=KIS 일시 제한/빈 응답) → 간격을 두고 재시도(최대 2회).
        // 재시도는 큐(동시성 3)를 통해 나가므로 첫 폭주가 가신 뒤 호출돼 대부분 성공한다.
        if (attempt < 2) {
          setTimeout(() => { if (!cancelled) load(attempt + 1); }, 1500);
          return;
        }
        // 재시도 후에도 실패 → 0원 대신 명확한 실패 표시
        setQuote(null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.warn("[WatchlistStockCard] load failed:", e);
        if (attempt < 2) {
          setTimeout(() => { if (!cancelled) load(attempt + 1); }, 1200);
          return;
        }
        setQuote(null);
        setLoading(false);
      }
    }

    load(0);
    return () => { cancelled = true; };
  }, [symbol, market, reloadKey]);

  const currentPrice = quote?.price ?? 0;

  const supportLevels = useMemo(
    () => calcSupportLevels(candles, currentPrice),
    [candles, currentPrice],
  );

  const bounce = useMemo(
    () => detectBounce(candles, currentPrice, supportLevels),
    [candles, currentPrice, supportLevels],
  );

  // Separate support (below) and resistance (above)
  const supports   = supportLevels.filter(s => s.price < currentPrice * 0.99);
  const resistances = supportLevels.filter(s => s.price > currentPrice * 1.01);

  // Sort by distance from current price
  supports.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
  resistances.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  const nearestSupport = supports[0];
  const distToSupport = nearestSupport && currentPrice
    ? ((currentPrice - nearestSupport.price) / nearestSupport.price * 100)
    : null;

  const handleRemove = () => {
    onRemove(item.symbol);
    toast.success(`${item.name} 관심종목 삭제됨`);
  };

  const isUp = (quote?.changePercent ?? 0) >= 0;

  return (
    <div
      className={cn(
        "card p-4 relative transition-all duration-300",
        bounce.detected && "ring-2 ring-yellow-400 dark:ring-yellow-500 shadow-lg shadow-yellow-100 dark:shadow-yellow-900/20",
      )}
    >
      {/* Header: Name + Price + Change in single row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{item.name}</h4>
            {loading ? (
              <div className="flex gap-2 animate-pulse">
                <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            ) : quote ? (
              <>
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                  {fmt(currentPrice, market, quote.currency)}
                </span>
                <span className={cn("text-sm font-semibold font-mono", isUp ? "text-red-500" : "text-blue-500")}>
                  {isUp ? "▲" : "▼"} {formatPercent(Math.abs(quote.changePercent))}
                </span>
              </>
            ) : (
              <button
                onClick={() => setReloadKey(k => k + 1)}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                title="다시 시도"
              >
                <span>시세 불러오기 실패</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-xs">다시 시도 ↻</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">{symbol} · {market}</p>
        </div>

        {/* Star button - top right */}
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-yellow-400 hover:text-yellow-500 shrink-0"
          title="관심종목 삭제"
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Bounce badge */}
      {bounce.detected && (
        <div className="mb-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
              bounce.strength === "강"
                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                : "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30"
            )}
          >
            📈 지지선 반등 감지 ({bounce.strength})
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
            {bounce.reason}
          </p>
        </div>
      )}

      {/* Nearest support summary */}
      {nearestSupport && currentPrice ? (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">가장 가까운 지지선</span>
            <span className="text-xs text-slate-400 tabular-nums">
              {distToSupport !== null ? `현재가 +${distToSupport.toFixed(1)}% 위` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{scoreEmoji(nearestSupport.score)}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {fmt(nearestSupport.price, market)}
            </span>
            <span className={cn("text-xs font-semibold", scoreColor(nearestSupport.score))}>
              강도 {nearestSupport.score}/4
            </span>
          </div>
        </div>
      ) : !loading && candles.length > 20 && supports.length === 0 ? (
        <p className="text-xs text-slate-400 mb-3 text-center py-2 bg-slate-50 dark:bg-slate-800/50 rounded">
          현재가 아래 지지선 없음
        </p>
      ) : null}

      {/* Toggle button */}
      {candles.length > 20 && (
        <>
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              지지선 분석 보기
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Detailed accordion */}
          {expanded && (
            <div className="mt-3 space-y-3">
              {/* Support levels (below current price) */}
              {supports.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    🔻 지지선 (현재가 아래)
                  </h5>
                  <div className="space-y-2">
                    {supports.map((lvl, i) => (
                      <LevelCard key={i} level={lvl} currentPrice={currentPrice} market={market} />
                    ))}
                  </div>
                </div>
              )}

              {/* Resistance levels (above current price) */}
              {resistances.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    🔺 저항선 (현재가 위)
                  </h5>
                  <div className="space-y-2">
                    {resistances.map((lvl, i) => (
                      <LevelCard key={i} level={lvl} currentPrice={currentPrice} market={market} />
                    ))}
                  </div>
                </div>
              )}

              {supports.length === 0 && resistances.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">
                  지지선 데이터 부족 (120일 이상 필요)
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LevelCard({ level, currentPrice, market }: { level: SupportLevel; currentPrice: number; market: "KR" | "US" }) {
  const distPct = (((level.price - currentPrice) / currentPrice) * 100).toFixed(1);
  const distLabel = parseFloat(distPct) > 0 ? `+${distPct}%` : `${distPct}%`;

  return (
    <div
      className={cn(
        "rounded-lg p-3 border text-xs",
        level.score >= 3
          ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10"
          : level.score === 2
          ? "border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-900/10"
          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{scoreEmoji(level.score)}</span>
          <span className="font-bold font-mono text-slate-800 dark:text-slate-100">
            {fmt(level.price, market)}
          </span>
        </div>
        <span className="text-slate-400 tabular-nums font-semibold">
          {distLabel}
        </span>
      </div>

      {/* Reasons */}
      <div className="space-y-1 mb-2">
        <ReasonRow
          active={!!level.reasons.historicalLows}
          label={
            level.reasons.historicalLows
              ? `과거 저점 ${level.reasons.historicalLows.count}회 (${level.reasons.historicalLows.dates.slice(-2).join(", ")})`
              : "과거 저점 미해당"
          }
        />
        <ReasonRow
          active={!!level.reasons.movingAverage}
          label={
            level.reasons.movingAverage
              ? `${level.reasons.movingAverage.period}일 이동평균선`
              : "이동평균선 미해당"
          }
        />
        <ReasonRow
          active={!!level.reasons.fibonacci}
          label={
            level.reasons.fibonacci
              ? `피보나치 ${level.reasons.fibonacci.label}`
              : "피보나치 미해당"
          }
        />
        <ReasonRow
          active={!!level.reasons.volumeConcentration}
          label={
            level.reasons.volumeConcentration
              ? `거래량 집중 (${level.reasons.volumeConcentration.date})`
              : "거래량 집중 미해당"
          }
        />
      </div>

      {/* Score */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <span className="text-slate-500">강도: </span>
        <span className={cn("font-bold", scoreColor(level.score))}>
          {level.score}/4
        </span>
      </div>
    </div>
  );
}

function ReasonRow({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={cn("flex items-start gap-1.5", active ? "text-slate-700 dark:text-slate-200" : "text-slate-400")}>
      <span className="shrink-0 mt-0.5">{active ? "✅" : "❌"}</span>
      <span className="leading-tight">{label}</span>
    </div>
  );
}
