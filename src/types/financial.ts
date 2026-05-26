export interface FinancialReport {
  period: string;           // "2024" | "24Q1" etc.
  revenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  operatingMargin?: number; // %
  netIncome?: number;
  netMargin?: number;       // %
  ebitda?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  debtRatio?: number;       // 부채비율 %
  operatingCashFlow?: number;
  capex?: number;           // 보통 음수
  freeCashFlow?: number;
}

export interface FinancialData {
  symbol: string;
  name: string;
  market: "KR" | "US";
  currency: "KRW" | "USD";
  unit: "억원" | "백만달러";
  annual: FinancialReport[];    // 오래된 순서
  quarterly: FinancialReport[]; // 오래된 순서
  isMock: boolean;
}
