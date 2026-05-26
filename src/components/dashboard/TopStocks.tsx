"use client";

import { cn, formatPercent, formatPrice } from "@/lib/utils";
import type { TopStock } from "@/types/stock";
import { Badge } from "@/components/ui/Badge";

interface TopStocksProps {
  stocks: TopStock[];
}

export function TopStocks({ stocks }: TopStocksProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">인기 종목 TOP 10</h3>
        <div className="flex gap-1.5">
          <Badge variant="neutral">KR+US</Badge>
        </div>
      </div>

      <div className="space-y-0.5">
        {stocks.map((stock) => (
          <div
            key={stock.symbol}
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
          >
            <span className="text-sm font-bold text-slate-300 dark:text-slate-600 w-5 text-center flex-shrink-0">
              {stock.rank}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                  {stock.name}
                </span>
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium shrink-0",
                    stock.market === "KR"
                      ? "bg-orange-500/10 text-orange-500"
                      : "bg-blue-500/10 text-blue-400"
                  )}
                >
                  {stock.market}
                </span>
              </div>
              {stock.reason && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{stock.reason}</p>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
                {formatPrice(stock.price, stock.market)}
              </p>
              <p
                className={cn(
                  "text-xs font-mono font-medium",
                  stock.changePercent > 0 ? "text-red-500" : "text-blue-500"
                )}
              >
                {formatPercent(stock.changePercent)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
