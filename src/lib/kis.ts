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
    const json = await callKis<InquirePriceResp>(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code },
      { trId: "FHKST01010100" },
    );
    if (json.rt_cd !== "0" || !json.output) {
      console.warn(`[kis] inquire-price ${code}: ${json.msg1 ?? "no data"}`);
      return null;
    }
    const o = json.output;
    const price      = num(o.stck_prpr) ?? 0;
    const prevClose  = num(o.stck_sdpr) ?? price;
    const sign       = num(o.prdy_vrss_sign) ?? 3;
    const rawChange  = num(o.prdy_vrss) ?? 0;
    const change     = (sign === 4 || sign === 5) ? -Math.abs(rawChange) : Math.abs(rawChange);
    const rawPct     = num(o.prdy_ctrt) ?? 0;
    // Recalculate from actual price delta; prdy_ctrt can return "0.00" for
    // mid/small-cap KOSDAQ stocks (e.g. 파두 440110) due to KIS data inconsistency.
    const changePct  = prevClose > 0
      ? Math.round((change / prevClose) * 10000) / 100
      : (sign === 4 || sign === 5 ? -Math.abs(rawPct) : Math.abs(rawPct));
    const htsAvls    = num(o.hts_avls); // 단위: 억원
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
