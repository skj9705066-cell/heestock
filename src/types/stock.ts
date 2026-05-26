export interface Stock {
  symbol: string;
  name: string;
  nameKr?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  market: "KR" | "US";
  sector?: string;
  industry?: string;
}

export interface StockDetail extends Stock {
  high52w: number;
  low52w: number;
  per?: number;
  pbr?: number;
  roe?: number;
  eps?: number;
  dividendYield?: number;
  description?: string;
  relativeStrength?: {
    oneMonth: number;
    threeMonth: number;
    sixMonth: number;
    twelveMonth: number;
    composite: number;
  };
  mttTemplate?: {
    stage2: boolean;
    aboveMa50: boolean;
    aboveMa150: boolean;
    aboveMa200: boolean;
    ma50AboveMa150: boolean;
    ma150AboveMa200: boolean;
    ma200Trending: boolean;
    rs52wHigh: boolean;
    priceAbove10: boolean;
    meets: boolean;
    score: number;
  };
}

export interface ValuationData {
  symbol: string;
  name: string;
  sector: string;
  per?: number;
  pbr?: number;
  roe?: number;
  psr?: number;
  evEbitda?: number;
  forwardPer?: {
    year1?: number;
    year2?: number;
    year3?: number;
    isAIEstimate?: boolean;
  };
  peers?: PeerStock[];
}

export interface PeerStock {
  symbol: string;
  name: string;
  per?: number;
  pbr?: number;
  roe?: number;
  marketCap: number;
}

export interface RSRankingEntry {
  rank: number;
  symbol: string;
  name: string;
  market: "KR" | "US";
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  rs1m: number;
  rs3m: number;
  rs6m: number;
  rs12m: number;
  rsComposite: number;
  mttMeets: boolean;
  stage: number;
}

export interface TopStock {
  rank: number;
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  market: "KR" | "US";
  reason?: string;
}
