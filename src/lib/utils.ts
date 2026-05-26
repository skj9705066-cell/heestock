import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals = 0): string {
  if (Math.abs(num) >= 1_000_000_000_000) {
    return (num / 1_000_000_000_000).toFixed(1) + "조";
  }
  if (Math.abs(num) >= 100_000_000) {
    return (num / 100_000_000).toFixed(1) + "억";
  }
  if (Math.abs(num) >= 10_000) {
    return (num / 10_000).toFixed(1) + "만";
  }
  return num.toLocaleString("ko-KR", { maximumFractionDigits: decimals });
}

export function formatUSD(num: number): string {
  if (Math.abs(num) >= 1_000_000_000_000) {
    return "$" + (num / 1_000_000_000_000).toFixed(2) + "T";
  }
  if (Math.abs(num) >= 1_000_000_000) {
    return "$" + (num / 1_000_000_000).toFixed(2) + "B";
  }
  if (Math.abs(num) >= 1_000_000) {
    return "$" + (num / 1_000_000).toFixed(2) + "M";
  }
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatPercent(num: number, showSign = true): string {
  const sign = showSign && num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

export function formatPrice(price: number, market: "KR" | "US"): string {
  if (market === "KR") {
    return price.toLocaleString("ko-KR") + "원";
  }
  return "$" + price.toFixed(2);
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function getChangeColor(change: number): string {
  if (change > 0) return "text-red-500";
  if (change < 0) return "text-blue-500";
  return "text-gray-400";
}

export function getChangeBg(change: number): string {
  if (change > 0) return "bg-red-500/10 text-red-500";
  if (change < 0) return "bg-blue-500/10 text-blue-500";
  return "bg-gray-500/10 text-gray-400";
}

export function getSignalColor(signal: "red" | "yellow" | "green"): string {
  const map = {
    red: "bg-red-500",
    yellow: "bg-yellow-400",
    green: "bg-emerald-500",
  };
  return map[signal];
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
