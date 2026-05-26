"use client";

import { cn, getSignalColor } from "@/lib/utils";
import type { MarketSignal } from "@/types/market";

interface SignalLightProps {
  signal: MarketSignal;
}

const signalLabels = {
  red: "위험",
  yellow: "주의",
  green: "안전",
};

const signalDescColors = {
  red: "text-red-400",
  yellow: "text-yellow-400",
  green: "text-emerald-400",
};

export function SignalLight({ signal }: SignalLightProps) {
  return (
    <div className="card p-5 flex flex-col items-center text-center space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {signal.type === "short" ? "단기 신호" : "장기 신호"}
      </p>

      {/* Traffic Light */}
      <div className="relative">
        <div className="w-16 h-44 bg-slate-800 dark:bg-slate-900 rounded-2xl border border-slate-700 flex flex-col items-center justify-around py-4 px-3">
          {(["red", "yellow", "green"] as const).map((color) => (
            <div
              key={color}
              className={cn(
                "w-8 h-8 rounded-full transition-all duration-500",
                signal.signal === color
                  ? cn(getSignalColor(color), "shadow-lg opacity-100")
                  : "bg-slate-700 opacity-30"
              )}
              style={
                signal.signal === color
                  ? {
                      boxShadow:
                        color === "red"
                          ? "0 0 16px rgba(239,68,68,0.6)"
                          : color === "yellow"
                          ? "0 0 16px rgba(234,179,8,0.6)"
                          : "0 0 16px rgba(16,185,129,0.6)",
                    }
                  : {}
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p
          className={cn(
            "text-xl font-bold",
            signalDescColors[signal.signal]
          )}
        >
          {signalLabels[signal.signal]}
        </p>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
          {signal.label}
        </p>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          {signal.description}
        </p>
        {signal.value !== undefined && (
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
            {signal.value}
          </p>
        )}
      </div>
    </div>
  );
}
