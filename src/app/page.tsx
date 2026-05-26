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
import {
  mockMarketIndices, mockSectorData, mockInvestorFlow, mockTopStocks,
} from "@/lib/mock-data";
import { Clock } from "lucide-react";

// Revalidate every 60 s so Next.js doesn't cache stale data on the edge
export const revalidate = 60;

export default async function DashboardPage() {
  const now = new Date();

  // Fetch all data in parallel; fall back to mock on error
  const [idxRes, topRes, secRes] = await Promise.allSettled([
    getMarketIndices(),
    getTopStocks(),
    getSectors(),
  ]);

  const indices   = idxRes.status  === "fulfilled" ? idxRes.value  : mockMarketIndices;
  const topStocks = topRes.status  === "fulfilled" ? topRes.value  : mockTopStocks;
  const sectors   = secRes.status  === "fulfilled" ? secRes.value  : mockSectorData;

  // Investor flow uses indices for market-informed fallback
  const flowRes = await getInvestorFlow(indices).catch(() => mockInvestorFlow);

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {indices.map(index => (
            <MarketIndexCard key={index.symbol} index={index} />
          ))}
        </div>
      </section>

      {/* Real-time Market Chart */}
      <section>
        <MarketIndexChart />
      </section>

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: AI Summary + Investor Trend */}
        <div className="xl:col-span-1 space-y-6">
          <MarketSummaryAI indices={indices} />
          <InvestorTrend data={flowRes} />
        </div>

        {/* Center: Sector Heatmap */}
        <div className="xl:col-span-1">
          <SectorHeatmap sectors={sectors} />
        </div>

        {/* Right: Top Stocks */}
        <div className="xl:col-span-1">
          <TopStocks stocks={topStocks} />
        </div>
      </section>

      {/* Quick Stats — derived from real indices */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "코스피 등락",
            value: indices[0]?.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) ?? "—",
            change: `${indices[0]?.changePercent >= 0 ? "+" : ""}${indices[0]?.changePercent?.toFixed(2) ?? 0}%`,
            up: (indices[0]?.changePercent ?? 0) >= 0,
          },
          {
            label: "코스닥 등락",
            value: indices[1]?.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) ?? "—",
            change: `${indices[1]?.changePercent >= 0 ? "+" : ""}${indices[1]?.changePercent?.toFixed(2) ?? 0}%`,
            up: (indices[1]?.changePercent ?? 0) >= 0,
          },
          {
            label: "나스닥 등락",
            value: indices[2]?.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—",
            change: `${indices[2]?.changePercent >= 0 ? "+" : ""}${indices[2]?.changePercent?.toFixed(2) ?? 0}%`,
            up: (indices[2]?.changePercent ?? 0) >= 0,
          },
          {
            label: "S&P500 등락",
            value: indices[3]?.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—",
            change: `${indices[3]?.changePercent >= 0 ? "+" : ""}${indices[3]?.changePercent?.toFixed(2) ?? 0}%`,
            up: (indices[3]?.changePercent ?? 0) >= 0,
          },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <p className="text-xs text-slate-400 mb-1">{item.label}</p>
            <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {item.value}
            </p>
            <p className={item.up ? "text-xs text-red-500 font-medium" : "text-xs text-blue-500 font-medium"}>
              {item.change}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
