export interface MarketIndex {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  market: "KR" | "US";
}

// Daily KOSPI pool trading value (거래대금 in 억원). Yahoo-based aggregate of
// the 31-stock pool used in market-data.ts.
export interface MarketVolumePoint {
  date:  string; // "MM.DD"
  value: number; // 거래대금 in 억원
}

export interface SectorData {
  name: string;
  changePercent: number;
  volume: number;
  marketCap: number;
}

export interface MarketSignal {
  type: "short" | "long";
  signal: "red" | "yellow" | "green";
  label: string;
  description: string;
  value?: number;
}

export interface ADRData {
  date: string;
  adr: number;
  advancers: number;
  decliners: number;
}

export interface NewHighLowData {
  date: string;
  newHigh: number;
  newLow: number;
  ratio: number;
}

export interface BreakthroughStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  volumeRatio: number;
  industryAction: string;
  market: "KR" | "US";
}

export interface MarketSummary {
  date: string;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  keyPoints: string[];
}
