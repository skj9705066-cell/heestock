/**
 * 단일 시세 조회 함수 - 모든 화면의 시세 데이터는 이 함수를 통해서만 가져옴
 *
 * 원칙:
 * 1. 한국 종목: KIS API 단일 소스 (fallback 제거)
 * 2. 미국 종목: Yahoo Finance API
 * 3. changePercent 검증/재계산 한 곳에서만
 * 4. ±30% 초과 또는 부호 불일치 시 재계산, 그래도 이상하면 null 반환
 * 5. 조회 실패 시 옛 캐시값 절대 사용 안 함 → null 반환
 */

import { fetchKisPrice, type KisPrice } from "./kis";
import { fetchYFQuotes, type YFQuote } from "./yahoo-finance";

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  currency: string;
  source: "KIS" | "Yahoo";
  // KeyStats 정보 (KIS에서 함께 제공)
  per?: number;
  pbr?: number;
  eps?: number;
  bps?: number;
}

/**
 * 시세 데이터 검증
 * - price, previousClose 필수
 * - changePercent ±50% 이내 (±30% 초과는 재계산했지만 ±50% 넘으면 데이터 자체 오류)
 * - change와 changePercent 부호 일치
 */
function validateQuote(
  price: number,
  previousClose: number,
  change: number,
  changePercent: number,
  source: string
): boolean {
  // 필수 필드 검증
  if (!price || price <= 0) {
    console.error(`[quote] ${source}: invalid price=${price}`);
    return false;
  }
  if (!previousClose || previousClose <= 0) {
    console.error(`[quote] ${source}: invalid previousClose=${previousClose}`);
    return false;
  }

  // changePercent ±50% 초과 시 데이터 오류로 판단
  if (Math.abs(changePercent) > 50) {
    console.error(`[quote] ${source}: changePercent=${changePercent.toFixed(2)}% exceeds ±50% limit`);
    return false;
  }

  // change와 changePercent 부호 일치 검증 (오차 ±0.01% 허용)
  const signMismatch = (change > 0 && changePercent < -0.01) || (change < 0 && changePercent > 0.01);
  if (signMismatch) {
    console.warn(`[quote] ${source}: sign mismatch (change=${change.toFixed(2)}, changePct=${changePercent.toFixed(2)}%)`);
    // 부호 불일치는 경고만, 재계산 후 통과
  }

  return true;
}

/**
 * KIS 데이터 → Quote 변환 및 검증
 */
function normalizeKisQuote(kis: KisPrice, stockCode: string): Quote | null {
  const { price, previousClose, change, changePercent } = kis;

  // changePercent 재계산 (KIS가 잘못된 값 주는 경우 대비)
  let recalcPct = changePercent;
  if (price > 0 && previousClose > 0) {
    recalcPct = ((price - previousClose) / previousClose) * 100;

    // ±30% 초과 또는 부호 불일치 시 경고
    if (Math.abs(changePercent) > 30 || Math.abs(recalcPct - changePercent) > 1) {
      console.warn(
        `[quote] KIS ${stockCode}: original changePct=${changePercent.toFixed(2)}%, ` +
        `recalc=${recalcPct.toFixed(2)}%`
      );
    }
  }

  // 검증
  if (!validateQuote(price, previousClose, change, recalcPct, `KIS ${stockCode}`)) {
    return null;
  }

  return {
    symbol: stockCode,
    price,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(recalcPct * 100) / 100,
    previousClose,
    volume: kis.volume,
    dayHigh: kis.dayHigh,
    dayLow: kis.dayLow,
    fiftyTwoWeekHigh: kis.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: kis.fiftyTwoWeekLow,
    marketCap: kis.marketCap,
    currency: "KRW",
    source: "KIS",
    // KeyStats 포함 (중복 조회 방지)
    per: kis.per,
    pbr: kis.pbr,
    eps: kis.eps,
    bps: kis.bps,
  };
}

/**
 * Yahoo Finance 데이터 → Quote 변환 및 검증
 */
function normalizeYahooQuote(yf: YFQuote, market: "KR" | "US"): Quote | null {
  const price = yf.regularMarketPrice;
  if (!price || price <= 0) {
    console.error(`[quote] Yahoo ${yf.symbol}: invalid price=${price}`);
    return null;
  }

  const previousClose = yf.regularMarketPreviousClose ?? price;
  if (!previousClose || previousClose <= 0) {
    console.error(`[quote] Yahoo ${yf.symbol}: invalid previousClose=${previousClose}`);
    return null;
  }

  // change, changePercent 재계산 (Yahoo 데이터 신뢰 안 함)
  const change = price - previousClose;
  const changePercent = (change / previousClose) * 100;

  // 원본 값과 비교
  const yfChange = yf.regularMarketChange ?? change;
  const yfChangePct = yf.regularMarketChangePercent ?? changePercent;

  if (Math.abs(yfChangePct) > 30 || Math.abs(changePercent - yfChangePct) > 1) {
    console.warn(
      `[quote] Yahoo ${yf.symbol}: original changePct=${yfChangePct.toFixed(2)}%, ` +
      `recalc=${changePercent.toFixed(2)}%`
    );
  }

  // 검증
  if (!validateQuote(price, previousClose, change, changePercent, `Yahoo ${yf.symbol}`)) {
    return null;
  }

  return {
    symbol: yf.symbol,
    price,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    previousClose,
    volume: yf.regularMarketVolume,
    dayHigh: yf.regularMarketDayHigh,
    dayLow: yf.regularMarketDayLow,
    fiftyTwoWeekHigh: yf.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: yf.fiftyTwoWeekLow,
    marketCap: yf.marketCap,
    currency: market === "KR" ? "KRW" : "USD",
    source: "Yahoo",
  };
}

/**
 * 단일 시세 조회 함수
 *
 * @param symbol 종목코드 (한국: 6자리 숫자, 미국: AAPL 등)
 * @param market "KR" | "US"
 * @returns Quote | null (조회 실패 시 null, 절대 옛 캐시값 반환 안 함)
 */
export async function getQuote(symbol: string, market: "KR" | "US"): Promise<Quote | null> {
  // 종목코드 정규화: .KS/.KQ 제거, 한국 종목은 6자리로 패딩
  let cleanSymbol = String(symbol).replace(/\.(KS|KQ)$/, "");

  // 한국 종목: 숫자로 변환되었거나 앞자리 0이 떨어진 경우 복구
  if (market === "KR" && /^\d+$/.test(cleanSymbol)) {
    cleanSymbol = cleanSymbol.padStart(6, "0");
    if (cleanSymbol !== symbol) {
      console.warn(`[getQuote] ${symbol} → ${cleanSymbol} (6자리 패딩)`);
    }
  }

  console.log(`[getQuote] ${cleanSymbol} (${market}) - start`);

  // 한국 종목: KIS 단일 소스 (Yahoo fallback 제거)
  if (market === "KR") {
    try {
      const kis = await fetchKisPrice(cleanSymbol);
      if (kis) {
        const quote = normalizeKisQuote(kis, cleanSymbol);
        if (quote) {
          console.log(`[getQuote] ${cleanSymbol}: KIS success - price=${quote.price}, change=${quote.changePercent.toFixed(2)}%`);
          return quote;
        }
        console.warn(`[getQuote] ${cleanSymbol}: KIS returned data but validation failed`);
      }
    } catch (err) {
      console.error(`[getQuote] ${cleanSymbol}: KIS error:`, (err as Error).message);
    }

    // KIS 실패 시 null 반환 (fallback 없음)
    console.error(`[getQuote] ${cleanSymbol}: KIS failed - no fallback for KR stocks`);
    return null;
  }

  // 미국 종목: Yahoo만
  try {
    const yfQuotes = await fetchYFQuotes([cleanSymbol]);
    const yf = yfQuotes[0];

    if (yf) {
      const quote = normalizeYahooQuote(yf, market);
      if (quote) {
        console.log(`[getQuote] ${cleanSymbol}: Yahoo success - price=${quote.price}, change=${quote.changePercent.toFixed(2)}%`);
        return quote;
      }
      console.warn(`[getQuote] ${cleanSymbol}: Yahoo returned data but validation failed`);
    }
  } catch (err) {
    console.error(`[getQuote] ${cleanSymbol}: Yahoo error:`, (err as Error).message);
  }

  console.error(`[getQuote] ${cleanSymbol}: Yahoo failed`);
  return null;
}

/**
 * 여러 종목 일괄 조회
 */
export async function getQuotes(
  items: Array<{ symbol: string; market: "KR" | "US" }>
): Promise<Map<string, Quote>> {
  const results = await Promise.allSettled(
    items.map(item => getQuote(item.symbol, item.market))
  );

  const map = new Map<string, Quote>();
  items.forEach((item, i) => {
    const result = results[i];
    if (result.status === "fulfilled" && result.value) {
      map.set(item.symbol, result.value);
    }
  });

  return map;
}
