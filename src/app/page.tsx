import { MarketIndexCard }   from "@/components/dashboard/MarketIndexCard";
import { MarketSummaryAI }  from "@/components/dashboard/MarketSummaryAI";
import { InvestorTrend }    from "@/components/dashboard/InvestorTrend";
import { TopStocks }        from "@/components/dashboard/TopStocks";
import { SectorHeatmap }    from "@/components/dashboard/SectorHeatmap";
import { MarketIndexChart } from "@/components/dashboard/MarketIndexChart";
import {
  getMarketIndices,
  getTopStocks,
  getSectors,
  getInvestorFlow,
} from "@/lib/market-data";
import { Clock, AlertCircle } from "lucide-react";

// Revalidate every 60 s so Next.js doesn't cache stale data on the edge
export const revalidate = 60;

export default async function DashboardPage() {
  const now = new Date();

  // Fetch all data in parallel. Empty arrays on failure — each section renders its own empty state.
  const [idxRes, topRes, secRes, flowRes] = await Promise.allSettled([
    getMarketIndices(),
    getTopStocks(),
    getSectors(),
    getInvestorFlow(),
  ]);

  const indices   = idxRes.status  === "fulfilled" ? idxRes.value  : [];
  const topStocks = topRes.status  === "fulfilled" ? topRes.value  : [];
  const sectors   = secRes.status  === "fulfilled" ? secRes.value  : [];
  const flowData  = flowRes.status === "fulfilled" ? flowRes.value : [];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">대시보드</h1>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm text-slate-400">
              {now.toLocaleDateString("ko-KR", {
                year: "numeric", month: "long", day: "numeric", weekday: "short",
              })}{" "}·{" "}
              {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
            </span>
          </div>
        </div>
      </div>

      {/* Market Index Cards */}
      <section>
        {indices.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {indices.map(index => (
              <MarketIndexCard key={index.symbol} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState message="시장 지수 데이터를 불러올 수 없습니다" />
        )}
      </section>

      {/* Real-time Market Chart */}
      <section>
        <MarketIndexChart />
      </section>

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: AI Summary + Investor Trend */}
        <div className="xl:col-span-1 space-y-6">
          {indices.length > 0 ? (
            <MarketSummaryAI indices={indices} />
          ) : null}
          {flowData.length > 0 ? (
            <InvestorTrend data={flowData} />
          ) : (
            <EmptyState message="수급 데이터를 불러올 수 없습니다 (네이버 금융 응답 실패)" />
          )}
        </div>

        {/* Center: Sector Heatmap */}
        <div className="xl:col-span-1">
          {sectors.length > 0 ? (
            <SectorHeatmap sectors={sectors} />
          ) : (
            <EmptyState message="섹터 데이터를 불러올 수 없습니다" />
          )}
        </div>

        {/* Right: Top Stocks */}
        <div className="xl:col-span-1">
          {topStocks.length > 0 ? (
            <TopStocks stocks={topStocks} />
          ) : (
            <EmptyState message="인기 종목 데이터를 불러올 수 없습니다" />
          )}
        </div>
      </section>

      {/* Quick Stats — derived from real indices */}
      {indices.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {indices.slice(0, 4).map(index => {
            const up = (index.changePercent ?? 0) >= 0;
            const locale = index.market === "US" ? "en-US" : "ko-KR";
            return (
              <div key={index.symbol} className="card p-4">
                <p className="text-xs text-slate-400 mb-1">{index.name} 등락</p>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {index.value.toLocaleString(locale, { maximumFractionDigits: 2 })}
                </p>
                <p className={up ? "text-xs text-red-500 font-medium" : "text-xs text-blue-500 font-medium"}>
                  {up ? "+" : ""}{index.changePercent.toFixed(2)}%
                </p>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card p-8 flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
      <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <p className="text-xs text-slate-400">잠시 후 다시 시도해주세요</p>
    </div>
  );
}
