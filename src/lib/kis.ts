// Korea Investment & Securities (KIS) Open API client.
// Docs: https://apiportal.koreainvestment.com
//
// We use the production endpoint (real market data). The OAuth2 access token
// is valid for 24 h and KIS rate-limits the token endpoint to ~1/min, so we
// cache it in memory and serialize concurrent requests behind a promise lock.

const KIS_BASE = "https://openapi.koreainvestment.com:9443";

function appKey():    string { return process.env.KIS_APP_KEY    ?? ""; }
function appSecret(): string { return process.env.KIS_APP_SECRET ?? ""; }

// ── Token management ─────────────────────────────────────────────────────────

let _token: { value: string; expiresAt: number } | null = null;
let _tokenPromise: Promise<string> | null = null;

async function getToken(): Promise<string> {
  // Refresh ~1 h before expiry to avoid edge-of-expiry races.
  if (_token && _token.expiresAt - Date.now() > 60 * 60_000) return _token.value;
  if (_tokenPromise) return _tokenPromise;

  if (!appKey() || !appSecret()) {
    throw new Error("KIS_APP_KEY / KIS_APP_SECRET not set");
  }

  _tokenPromise = (async () => {
    const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
      method:  "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body:    JSON.stringify({
        grant_type: "client_credentials",
        appkey:     appKey(),
        appsecret:  appSecret(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`KIS oauth2 ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json() as { access_token: string; expires_in: number };
    _token = {
      value:     json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 86_400) * 1_000,
    };
    return _token.value;
  })().finally(() => { _tokenPromise = null; });

  return _tokenPromise;
}

// ── Low-level call helper ────────────────────────────────────────────────────

interface KisHeaders {
  trId:     string;
  trCont?:  string;
}

async function callKis<T>(
  path:    string,
  params:  Record<string, string>,
  headers: KisHeaders,
): Promise<T> {
  const token = await getToken();
  const url   = new URL(`${KIS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      "content-type":  "application/json; charset=utf-8",
      "authorization": `Bearer ${token}`,
      "appkey":         appKey(),
      "appsecret":      appSecret(),
      "tr_id":          headers.trId,
      "tr_cont":        headers.trCont ?? "",
      "custtype":       "P",
    },
    signal: AbortSignal.timeout(10_000),
    cache:  "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`KIS ${path} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Parse KIS numeric strings (returned as e.g. "75800", "12.34", "-1234").
function num(s: string | undefined): number | undefined {
  if (s === undefined || s === null || s === "") return undefined;
  const clean = String(s).replace(/,/g, "").trim();
  if (clean === "" || clean === "-") return undefined;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : undefined;
}

// ── Inquire price (FHKST01010100) — current price + key stats ───────────────

export interface KisPrice {
  stockCode:          string;
  price:              number;
  previousClose:      number;
  change:             number;
  changePercent:      number;
  open:               number | undefined;
  dayHigh:            number | undefined;
  dayLow:             number | undefined;
  volume:             number | undefined;
  tradingValue:       number | undefined; // 누적 거래대금 (원)
  fiftyTwoWeekHigh:   number | undefined;
  fiftyTwoWeekLow:    number | undefined;
  marketCap:          number | undefined; // 시가총액 (원)
  listedShares:       number | undefined;
  per:                number | undefined;
  pbr:                number | undefined;
  eps:                number | undefined;
  bps:                number | undefined;
}

interface InquirePriceResp {
  rt_cd:  string;
  msg1?:  string;
  output: {
    stck_prpr:        string; // 현재가
    prdy_vrss:        string; // 전일대비
    prdy_vrss_sign:   string; // 1-5 (1: 상한, 2: 상승, 3: 보합, 4: 하한, 5: 하락)
    prdy_ctrt:        string; // 전일대비율
    stck_oprc:        string; // 시가
    stck_hgpr:        string; // 고가
    stck_lwpr:        string; // 저가
    stck_sdpr:        string; // 기준가 (전일 종가)
    acml_vol:         string; // 누적 거래량
    acml_tr_pbmn:     string; // 누적 거래대금 (원)
    w52_hgpr:         string; // 52주 최고가
    w52_lwpr:         string; // 52주 최저가
    per:              string;
    pbr:              string;
    eps:              string;
    bps:              string;
    hts_avls:         string; // 시가총액 (백만원 단위가 아닌 억원 단위)
    lstn_stcn:        string; // 상장주식수
  };
}

export async function fetchKisPrice(stockCode: string): Promise<KisPrice | null> {
  try {
    const code = stockCode.replace(/\.(KS|KQ)$/, "");
    const params = { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code };

    console.log(`[kis] fetchKisPrice START`);
    console.log(`[kis]   - Input: ${stockCode} → cleaned: ${code}`);
    console.log(`[kis]   - Params:`, JSON.stringify(params));
    console.log(`[kis]   - TR: FHKST01010100`);

    const json = await callKis<InquirePriceResp>(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      params,
      { trId: "FHKST01010100" },
    );

    console.log(`[kis] ${code} RAW RESPONSE:`);
    console.log(`[kis]   - rt_cd: ${json.rt_cd}`);
    console.log(`[kis]   - msg1: ${json.msg1 ?? "N/A"}`);
    console.log(`[kis]   - has_output: ${!!json.output}`);

    if (json.output) {
      const o = json.output;
      console.log(`[kis] === ${code} 단계별 추적 ===`);
      console.log(`[kis] 1단계 - KIS RAW 응답:`, JSON.stringify({
        stck_prpr: o.stck_prpr,
        stck_sdpr: o.stck_sdpr,
        prdy_vrss_sign: o.prdy_vrss_sign,
        prdy_vrss: o.prdy_vrss,
        prdy_ctrt: o.prdy_ctrt,
      }));
    } else {
      console.error(`[kis] ${code} NO OUTPUT - Full response:`, JSON.stringify(json));
    }

    if (json.rt_cd !== "0" || !json.output) {
      console.warn(`[kis] inquire-price ${code} FAILED: rt_cd=${json.rt_cd}, msg1=${json.msg1}`);
      return null;
    }
    const o = json.output;
    let price = num(o.stck_prpr) ?? 0;
    const prevClose  = num(o.stck_sdpr) ?? price;

    console.log(`[kis] 2단계 - 파싱 직후: price=${price}, prevClose=${prevClose}`);

    // ── 장 마감 후 0원 방지: 실시간 가격이 없으면 일봉에서 당일 종가 가져오기 ───
    if (price === 0 || !price) {
      console.warn(`[kis] ${code}: ✗ stck_prpr is 0 or empty, fetching closing price from daily candles`);
      try {
        const candles = await fetchKisDailyCandles(code, 1);
        if (candles.length > 0 && candles[candles.length - 1].close > 0) {
          price = candles[candles.length - 1].close;
          console.log(`[kis] ${code}: ✓ Using today's closing price ${price} from daily candles`);
        } else {
          console.warn(`[kis] ${code}: ✗ No valid closing price available - returning null`);
          return null;
        }
      } catch (err) {
        console.error(`[kis] ${code}: ✗ Failed to fetch closing price:`, (err as Error).message);
        return null;
      }
    } else {
      console.log(`[kis] ${code}: ✓ stck_prpr 정상 (${price}), 종가 fallback 불필요`);
    }

    const sign       = num(o.prdy_vrss_sign) ?? 3;
    let rawChange    = num(o.prdy_vrss) ?? 0;
    let change       = (sign === 4 || sign === 5) ? -Math.abs(rawChange) : Math.abs(rawChange);
    const rawPct     = num(o.prdy_ctrt) ?? 0;
    let changePct    = (sign === 4 || sign === 5) ? -Math.abs(rawPct) : Math.abs(rawPct);

    // ── 종가 사용 시 등락률 재계산 (장 마감 후 또는 비정상 값) ────────────────
    // 현재가와 전일종가로 직접 계산하여 정확도 확보
    if (price > 0 && prevClose > 0) {
      const recalcChange = price - prevClose;
      const recalcPct = (recalcChange / prevClose) * 100;

      // ±30% 초과하거나 부호 불일치 시 재계산 값 사용
      const signMismatch = (change > 0 && changePct < -0.01) || (change < 0 && changePct > 0.01);
      if (Math.abs(changePct) > 30 || signMismatch || rawChange === 0) {
        console.warn(
          `[kis] ${code}: Recalculating change - original: ${change}/${changePct.toFixed(2)}%, ` +
          `recalc: ${recalcChange}/${recalcPct.toFixed(2)}%`
        );
        change = recalcChange;
        changePct = recalcPct;
      }
    }

    // 재계산 후에도 ±50% 초과이면 데이터 자체가 신뢰 불가
    if (Math.abs(changePct) > 50 && price > 0) {
      console.warn(`[kis] ${code}: changePct ${changePct.toFixed(2)}% still abnormal, returning null`);
      return null;
    }
    const htsAvls    = num(o.hts_avls); // 단위: 억원

    console.log(`[kis] 3단계 - fetchKisPrice 최종 반환값: price=${price}, change=${change}, changePct=${changePct.toFixed(2)}%`);

    return {
      stockCode:        code,
      price,
      previousClose:    prevClose,
      change,
      changePercent:    changePct,
      open:             num(o.stck_oprc),
      dayHigh:          num(o.stck_hgpr),
      dayLow:           num(o.stck_lwpr),
      volume:           num(o.acml_vol),
      tradingValue:     num(o.acml_tr_pbmn),
      fiftyTwoWeekHigh: num(o.w52_hgpr),
      fiftyTwoWeekLow:  num(o.w52_lwpr),
      marketCap:        htsAvls !== undefined ? htsAvls * 100_000_000 : undefined,
      listedShares:     num(o.lstn_stcn),
      per:              num(o.per),
      pbr:              num(o.pbr),
      eps:              num(o.eps),
      bps:              num(o.bps),
    };
  } catch (err) {
    console.warn(`[kis] inquire-price failed for ${stockCode}:`, (err as Error).message);
    return null;
  }
}

// ── Inquire investor flow (FHKST01010900) — per-stock 외/기/개 net buy ──────
// Returns up to ~30 trading days, newest first. We keep the most recent 5.

export interface KisInvestorDay {
  date:        string; // "YYYY-MM-DD"
  close:       number | undefined;
  foreign:     number; // 외국인 순매수 (억원)
  institution: number; // 기관 순매수 (억원)
  individual:  number; // 개인 순매수 (억원)
}

interface InquireInvestorResp {
  rt_cd:    string;
  msg1?:    string;
  output:   Array<{
    stck_bsop_date:      string; // "YYYYMMDD"
    stck_clpr:           string; // 종가
    prsn_ntby_qty:       string; // 개인 순매수 수량
    frgn_ntby_qty:       string; // 외국인 순매수 수량
    orgn_ntby_qty:       string; // 기관 순매수 수량
    prsn_ntby_tr_pbmn:   string; // 개인 순매수 거래대금 (원)
    frgn_ntby_tr_pbmn:   string; // 외국인 순매수 거래대금 (원)
    orgn_ntby_tr_pbmn:   string; // 기관 순매수 거래대금 (원)
  }>;
}

export async function fetchKisInvestorFlow(
  stockCode: string,
  days = 5,
): Promise<KisInvestorDay[]> {
  try {
    const code = stockCode.replace(/\.(KS|KQ)$/, "");
    const json = await callKis<InquireInvestorResp>(
      "/uapi/domestic-stock/v1/quotations/inquire-investor",
      { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code },
      { trId: "FHKST01010900" },
    );
    if (json.rt_cd !== "0" || !Array.isArray(json.output)) {
      console.warn(`[kis] inquire-investor ${code}: ${json.msg1 ?? "no data"}`);
      return [];
    }

    const rows = json.output.slice(0, days).map((r): KisInvestorDay => {
      const raw = r.stck_bsop_date; // YYYYMMDD
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      // KIS inquire-investor reports *_ntby_tr_pbmn in 백만원 (million won).
      // Verified: SK하이닉스 frgn_ntby_qty -105,778 × close 2,243,000 ≈ 237 B won,
      // and frgn_ntby_tr_pbmn ≈ -238,363 (= -238,363 백만원). To get 억원, ÷100.
      const toUk = (s?: string) => {
        const n = num(s);
        return n !== undefined ? Math.round(n / 100) : 0;
      };
      return {
        date,
        close:       num(r.stck_clpr),
        foreign:     toUk(r.frgn_ntby_tr_pbmn),
        institution: toUk(r.orgn_ntby_tr_pbmn),
        individual:  toUk(r.prsn_ntby_tr_pbmn),
      };
    });

    // API returns newest-first; reverse so the array reads chronologically.
    return rows.reverse();
  } catch (err) {
    console.warn(`[kis] inquire-investor failed for ${stockCode}:`, (err as Error).message);
    return [];
  }
}

// ── Daily candle (FHKST03010100) — OHLCV history for support level analysis ─

export interface KisDailyCandle {
  date:   string; // "YYYY-MM-DD"
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

interface InquireDailyChartResp {
  rt_cd:   string;
  msg1?:   string;
  output1?: unknown;
  output2?: Array<{
    stck_bsop_date: string; // YYYYMMDD
    stck_oprc:      string; // 시가
    stck_hgpr:      string; // 고가
    stck_lwpr:      string; // 저가
    stck_clpr:      string; // 종가
    acml_vol:       string; // 누적 거래량
    prdy_vrss_sign: string;
  }>;
}

export async function fetchKisDailyCandles(
  stockCode: string,
  days = 130,
): Promise<KisDailyCandle[]> {
  try {
    const code = stockCode.replace(/\.(KS|KQ)$/, "");
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Math.round(days * 1.8)); // extra to account for holidays
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

    const json = await callKis<InquireDailyChartResp>(
      "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
      {
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD:         code,
        FID_INPUT_DATE_1:       fmt(start),
        FID_INPUT_DATE_2:       fmt(end),
        FID_PERIOD_DIV_CODE:    "D",
        FID_ORG_ADJ_PRC:        "0",
      },
      { trId: "FHKST03010100" },
    );

    if (json.rt_cd !== "0" || !Array.isArray(json.output2)) {
      console.warn(`[kis] daily-candle ${code}: ${json.msg1 ?? "no data"}`);
      return [];
    }

    // output2 is newest-first → reverse
    return json.output2
      .filter(r => r.stck_clpr && r.stck_clpr !== "0")
      .map((r): KisDailyCandle => {
        const d = r.stck_bsop_date;
        return {
          date:   `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,
          open:   num(r.stck_oprc)  ?? 0,
          high:   num(r.stck_hgpr)  ?? 0,
          low:    num(r.stck_lwpr)  ?? 0,
          close:  num(r.stck_clpr)  ?? 0,
          volume: num(r.acml_vol)   ?? 0,
        };
      })
      .filter(c => c.close > 0)
      .reverse()
      .slice(-days);
  } catch (err) {
    console.warn(`[kis] daily-candle failed for ${stockCode}:`, (err as Error).message);
    return [];
  }
}

// ── Index price (FHPUP02100000) — 코스피/코스닥 지수 현재가 ─────────────────

export interface KisIndexPrice {
  indexCode: string; // "0001" (코스피) or "1001" (코스닥)
  indexName: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume?: number;
  tradingValue?: number;
}

interface InquireIndexPriceResp {
  rt_cd: string;
  msg1?: string;
  output: {
    bstp_nmix_prpr: string; // 지수 현재가
    bstp_nmix_prdy_vrss: string; // 전일대비
    prdy_vrss_sign: string; // 전일대비 부호
    bstp_nmix_prdy_ctrt: string; // 전일대비율
    acml_vol: string; // 누적 거래량
    acml_tr_pbmn: string; // 누적 거래대금
    bstp_nmix_oprc: string; // 시가
    bstp_nmix_hgpr: string; // 고가
    bstp_nmix_lwpr: string; // 저가
  };
}

export async function fetchKisIndexPrice(
  indexCode: "0001" | "1001"
): Promise<KisIndexPrice | null> {
  try {
    const indexName = indexCode === "0001" ? "코스피" : "코스닥";

    console.log(`[kis] fetchKisIndexPrice START`);
    console.log(`[kis]   - indexCode: ${indexCode} (${indexName})`);
    console.log(`[kis]   - TR: FHPUP02100000`);

    const json = await callKis<InquireIndexPriceResp>(
      "/uapi/domestic-stock/v1/quotations/inquire-index-price",
      {
        FID_COND_MRKT_DIV_CODE: "U",
        FID_INPUT_ISCD: indexCode,
      },
      { trId: "FHPUP02100000" }
    );

    console.log(`[kis] ${indexName} RAW RESPONSE:`);
    console.log(`[kis]   - rt_cd: ${json.rt_cd}`);
    console.log(`[kis]   - msg1: ${json.msg1 ?? "N/A"}`);
    console.log(`[kis]   - has_output: ${!!json.output}`);

    if (json.rt_cd !== "0" || !json.output) {
      console.warn(`[kis] inquire-index-price ${indexCode} FAILED: rt_cd=${json.rt_cd}, msg1=${json.msg1}`);
      return null;
    }

    const o = json.output;
    console.log(`[kis] ${indexName} OUTPUT:`, JSON.stringify({
      bstp_nmix_prpr: o.bstp_nmix_prpr,
      bstp_nmix_prdy_vrss: o.bstp_nmix_prdy_vrss,
      prdy_vrss_sign: o.prdy_vrss_sign,
      bstp_nmix_prdy_ctrt: o.bstp_nmix_prdy_ctrt,
    }));

    const price = num(o.bstp_nmix_prpr) ?? 0;
    const sign = num(o.prdy_vrss_sign) ?? 3;
    const rawChange = num(o.bstp_nmix_prdy_vrss) ?? 0;
    const change = (sign === 4 || sign === 5) ? -Math.abs(rawChange) : Math.abs(rawChange);
    const rawPct = num(o.bstp_nmix_prdy_ctrt) ?? 0;
    const changePercent = (sign === 4 || sign === 5) ? -Math.abs(rawPct) : Math.abs(rawPct);

    // 전일종가 = 현재가 - 전일대비
    const previousClose = price - change;

    console.log(`[kis] ${indexName} RESULT:`);
    console.log(`[kis]   - price: ${price.toFixed(2)}`);
    console.log(`[kis]   - previousClose: ${previousClose.toFixed(2)}`);
    console.log(`[kis]   - change: ${change.toFixed(2)}`);
    console.log(`[kis]   - changePercent: ${changePercent.toFixed(2)}%`);

    return {
      indexCode,
      indexName,
      price,
      previousClose,
      change,
      changePercent,
      volume: num(o.acml_vol),
      tradingValue: num(o.acml_tr_pbmn),
    };
  } catch (err) {
    console.error(`[kis] inquire-index-price failed for ${indexCode}:`, (err as Error).message);
    return null;
  }
}
