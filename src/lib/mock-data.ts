import type { MarketIndex, SectorData, InvestorFlow, ADRData } from "@/types/market";
import type { TopStock, RSRankingEntry } from "@/types/stock";

export const mockMarketIndices: MarketIndex[] = [
  { name: "코스피", symbol: "KOSPI", value: 2651.34, change: 18.42, changePercent: 0.70, market: "KR" },
  { name: "코스닥", symbol: "KOSDAQ", value: 873.21, change: -4.15, changePercent: -0.47, market: "KR" },
  { name: "나스닥", symbol: "NASDAQ", value: 19287.45, change: 142.87, changePercent: 0.75, market: "US" },
  { name: "S&P500", symbol: "SPX", value: 5302.43, change: 28.15, changePercent: 0.53, market: "US" },
];

export const mockSectorData: SectorData[] = [
  { name: "반도체", changePercent: 2.34, volume: 15000000, marketCap: 850000000000 },
  { name: "2차전지", changePercent: -1.23, volume: 12000000, marketCap: 320000000000 },
  { name: "바이오", changePercent: 0.87, volume: 8000000, marketCap: 180000000000 },
  { name: "자동차", changePercent: 1.45, volume: 6000000, marketCap: 450000000000 },
  { name: "금융", changePercent: -0.32, volume: 5000000, marketCap: 280000000000 },
  { name: "소재", changePercent: -0.98, volume: 4500000, marketCap: 120000000000 },
  { name: "IT서비스", changePercent: 1.12, volume: 7000000, marketCap: 200000000000 },
  { name: "에너지", changePercent: 0.43, volume: 3500000, marketCap: 95000000000 },
  { name: "유통", changePercent: -1.67, volume: 2800000, marketCap: 75000000000 },
  { name: "건설", changePercent: -2.15, volume: 3200000, marketCap: 60000000000 },
  { name: "게임", changePercent: 3.21, volume: 9500000, marketCap: 140000000000 },
  { name: "엔터", changePercent: 0.65, volume: 4200000, marketCap: 85000000000 },
];

export const mockInvestorFlow: InvestorFlow[] = [
  { date: "05/20", foreign: 1234, institution: -567, individual: -667 },
  { date: "05/21", foreign: -892, institution: 345, individual: 547 },
  { date: "05/22", foreign: 2145, institution: 678, individual: -2823 },
  { date: "05/23", foreign: -1567, institution: -234, individual: 1801 },
  { date: "05/26", foreign: 987, institution: 432, individual: -1419 },
];

export const mockTopStocks: TopStock[] = [
  { rank: 1, symbol: "005930", name: "삼성전자", price: 78500, changePercent: 2.34, volume: 18500000, market: "KR", reason: "AI 반도체 수혜" },
  { rank: 2, symbol: "000660", name: "SK하이닉스", price: 195000, changePercent: 3.21, volume: 6200000, market: "KR", reason: "HBM 수요 급증" },
  { rank: 3, symbol: "NVDA", name: "엔비디아", price: 131.38, changePercent: 4.18, volume: 285000000, market: "US", reason: "AI 칩 실적 서프라이즈" },
  { rank: 4, symbol: "373220", name: "LG에너지솔루션", price: 398000, changePercent: -1.23, volume: 890000, market: "KR", reason: "전기차 수요 둔화" },
  { rank: 5, symbol: "AAPL", name: "애플", price: 213.49, changePercent: 1.87, volume: 65000000, market: "US", reason: "AI iPhone 기대감" },
  { rank: 6, symbol: "035720", name: "카카오", price: 42150, changePercent: -2.15, volume: 5600000, market: "KR", reason: "규제 리스크" },
  { rank: 7, symbol: "TSLA", name: "테슬라", price: 177.58, changePercent: 2.93, volume: 98000000, market: "US", reason: "로보택시 기대감" },
  { rank: 8, symbol: "207940", name: "삼성바이오로직스", price: 978000, changePercent: 0.87, volume: 320000, market: "KR", reason: "바이오 수출 증가" },
  { rank: 9, symbol: "META", name: "메타", price: 567.12, changePercent: 1.45, volume: 18000000, market: "US", reason: "AI 광고 수익 증가" },
  { rank: 10, symbol: "012330", name: "현대모비스", price: 248500, changePercent: 1.12, volume: 780000, market: "KR", reason: "전장부품 성장" },
];

export const mockRSRanking: RSRankingEntry[] = [
  { rank: 1, symbol: "000660", name: "SK하이닉스", market: "KR", sector: "반도체", price: 195000, change: 6100, changePercent: 3.21, rs1m: 98, rs3m: 96, rs6m: 94, rs12m: 91, rsComposite: 95, mttMeets: true, stage: 2 },
  { rank: 2, symbol: "NVDA", name: "엔비디아", market: "US", sector: "반도체", price: 131.38, change: 5.27, changePercent: 4.18, rs1m: 97, rs3m: 95, rs6m: 93, rs12m: 89, rsComposite: 94, mttMeets: true, stage: 2 },
  { rank: 3, symbol: "005930", name: "삼성전자", market: "KR", sector: "반도체", price: 78500, change: 1800, changePercent: 2.34, rs1m: 85, rs3m: 83, rs6m: 80, rs12m: 78, rsComposite: 82, mttMeets: true, stage: 2 },
  { rank: 4, symbol: "META", name: "메타", market: "US", sector: "소셜미디어", price: 567.12, change: 8.11, changePercent: 1.45, rs1m: 92, rs3m: 90, rs6m: 88, rs12m: 85, rsComposite: 89, mttMeets: true, stage: 2 },
  { rank: 5, symbol: "AVGO", name: "브로드컴", market: "US", sector: "반도체", price: 178.34, change: 3.21, changePercent: 1.84, rs1m: 90, rs3m: 88, rs6m: 85, rs12m: 82, rsComposite: 87, mttMeets: true, stage: 2 },
  { rank: 6, symbol: "042700", name: "한미반도체", market: "KR", sector: "반도체장비", price: 88500, change: 2500, changePercent: 2.91, rs1m: 88, rs3m: 86, rs6m: 83, rs12m: 79, rsComposite: 85, mttMeets: true, stage: 2 },
  { rank: 7, symbol: "MSFT", name: "마이크로소프트", market: "US", sector: "소프트웨어", price: 427.89, change: 4.32, changePercent: 1.02, rs1m: 82, rs3m: 84, rs6m: 86, rs12m: 83, rsComposite: 84, mttMeets: true, stage: 2 },
  { rank: 8, symbol: "035420", name: "NAVER", market: "KR", sector: "IT서비스", price: 198500, change: 1500, changePercent: 0.76, rs1m: 75, rs3m: 77, rs6m: 74, rs12m: 72, rsComposite: 75, mttMeets: false, stage: 1 },
  { rank: 9, symbol: "AAPL", name: "애플", market: "US", sector: "하드웨어", price: 213.49, change: 3.91, changePercent: 1.87, rs1m: 79, rs3m: 81, rs6m: 79, rs12m: 76, rsComposite: 79, mttMeets: true, stage: 2 },
  { rank: 10, symbol: "TSLA", name: "테슬라", market: "US", sector: "전기차", price: 177.58, change: 5.05, changePercent: 2.93, rs1m: 76, rs3m: 72, rs6m: 68, rs12m: 65, rsComposite: 70, mttMeets: false, stage: 1 },
];

export const mockADRData: ADRData[] = [
  { date: "05/20", adr: 1.23, advancers: 512, decliners: 416 },
  { date: "05/21", adr: 0.87, advancers: 398, decliners: 458 },
  { date: "05/22", adr: 1.45, advancers: 534, decliners: 369 },
  { date: "05/23", adr: 1.12, advancers: 487, decliners: 435 },
  { date: "05/26", adr: 1.34, advancers: 521, decliners: 389 },
];
