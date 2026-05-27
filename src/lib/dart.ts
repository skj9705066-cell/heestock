// DART OpenAPI — Korean financial statements
// Docs: https://opendart.fss.or.kr/api/guide/opr/OprMndt003.do

import { inflateRawSync } from "node:zlib";

const DART_BASE = "https://opendart.fss.or.kr/api";

// ── In-memory caches ──────────────────────────────────────────────────────────
const _corpCache = new Map<string, string>();                         // stockCode → dartCode
const _stmtCache = new Map<string, { data: DartItem[]; ts: number }>(); // 24 h TTL
const STMT_TTL = 24 * 60 * 60_000;

// Full DART corp list (downloaded on demand from corpCode.xml)
let _corpListCache: { list: DartCorp[]; ts: number } | null = null;
const CORP_LIST_TTL = 24 * 60 * 60_000;
let _corpListPromise: Promise<DartCorp[]> | null = null;

function dartKey(): string { return process.env.DART_API_KEY ?? ""; }

// ── DART response types ───────────────────────────────────────────────────────

interface DartItem {
  sj_div:             string;  // BS | IS | CIS | CF | SCE
  account_id:         string;  // IFRS account ID
  account_nm:         string;  // Korean account name
  thstrm_amount:      string;  // current period amount (KRW, raw string)
  thstrm_add_amount?: string;  // cumulative amount (quarterly reports)
  frmtrm_amount:      string;  // prior period
  bfefrmtrm_amount:   string;  // prior-prior period
}

interface DartListResponse {
  status:   string;
  message?: string;
  list?:    DartItem[];
}

// ── Account ID / name lookup tables ──────────────────────────────────────────

// IFRS account IDs (most reliable — verified against Samsung 2024 DART response)
const ACCT_ID: Record<string, string[]> = {
  revenue:          ["ifrs-full_Revenue", "ifrs_Revenue", "dart_Revenue",
                     "ifrs-full_RevenueFromContractsWithCustomers"],
  grossProfit:      ["ifrs-full_GrossProfit"],
  opIncome:         ["dart_OperatingIncomeLoss", "ifrs-full_OperatingProfit",
                     "ifrs_OperatingProfit"],
  // Use parent's share (지배기업 소유주지분) — excludes minority interest; more relevant for investors
  netIncome:        ["ifrs-full_ProfitLossAttributableToOwnersOfParent",
                     "ifrs-full_ProfitLoss"],
  totalAssets:      ["ifrs-full_Assets"],
  totalLiabilities: ["ifrs-full_Liabilities"],
  // Equity: filter to BS section to avoid SCE duplicates
  totalEquity:      ["ifrs-full_Equity"],
  opCF:             ["ifrs-full_CashFlowsFromUsedInOperatingActivities",
                     "ifrs-full_CashFlowsFromOperatingActivities"],
  // Full IFRS ID suffix for capex as observed in DART data
  capex:            ["ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
                     "ifrs-full_PurchaseOfPropertyPlantAndEquipment",
                     "ifrs-full_AcquisitionOfPropertyPlantAndEquipment"],
};

// Korean account names (fallback when IFRS IDs don't match)
const ACCT_NM: Record<string, string[]> = {
  revenue:          ["매출액", "수익(매출액)", "영업수익", "매출", "총영업수익"],
  grossProfit:      ["매출총이익", "매출총손익"],
  opIncome:         ["영업이익", "영업이익(손실)", "영업손익"],
  netIncome:        ["당기순이익", "당기순이익(손실)", "당기순손익", "지배기업 소유주 지분 당기순이익"],
  totalAssets:      ["자산총계"],
  totalLiabilities: ["부채총계"],
  totalEquity:      ["자본총계"],
  opCF:             ["영업활동현금흐름", "영업활동으로인한현금흐름",
                     "영업활동으로 인한 현금흐름", "영업활동현금유입(출)액"],
  capex:            ["유형자산의취득", "유형자산 취득", "유형자산취득",
                     "유형자산 등의 취득", "유형자산과 무형자산의 취득"],
};

// ── Helper: parse DART amount string → 억원 ──────────────────────────────────

function toUk(s: string | undefined): number | undefined {
  if (!s || s === "-" || s.trim() === "") return undefined;
  const clean = s.replace(/,/g, "").trim();
  // Handle negative values like "-123456789012"
  const n = parseInt(clean, 10);
  if (isNaN(n) || n === 0) return undefined;
  return Math.round(n / 100_000_000);
}

// ── Helper: find a value in DartItem[] by account ID or name ─────────────────

type Period = "thstrm" | "frmtrm" | "bfefrmtrm";

// Some account IDs appear in multiple sj_div sections; restrict the section for these.
// P&L items (IS/CIS) — companies use either separate IS or combined CIS format; exclude SCE.
const ACCT_SJ_FILTER: Record<string, string | string[]> = {
  totalEquity: "BS",              // ifrs-full_Equity: BS is right; SCE has wrong amounts
  netIncome:   ["IS", "CIS"],     // ProfitLoss in IS (separate stmt) or CIS (combined); exclude SCE
  grossProfit: ["IS", "CIS"],
  opIncome:    ["IS", "CIS"],
  opCF:        "CF",
  capex:       "CF",
};

function findVal(
  items: DartItem[],
  period: Period,
  key: string,
): number | undefined {
  const field  = `${period}_amount` as keyof DartItem;
  const ids    = ACCT_ID[key]  ?? [];
  const nms    = ACCT_NM[key]  ?? [];
  const sjDiv  = ACCT_SJ_FILTER[key]; // optional section filter

  const ok = (i: DartItem) => {
    if (!sjDiv) return true;
    return Array.isArray(sjDiv) ? sjDiv.includes(i.sj_div) : i.sj_div === sjDiv;
  };

  // 1) Match by IFRS account_id (exact)
  for (const id of ids) {
    const item = items.find(i => ok(i) && i.account_id === id);
    if (item) return toUk(item[field] as string);
  }
  // 2) Match by account_nm (exact, then starts-with)
  for (const nm of nms) {
    const item = items.find(i => ok(i) && i.account_nm.trim() === nm);
    if (item) return toUk(item[field] as string);
  }
  for (const nm of nms) {
    const item = items.find(i => ok(i) && i.account_nm.trim().startsWith(nm));
    if (item) return toUk(item[field] as string);
  }
  return undefined;
}

// ── DART API calls ────────────────────────────────────────────────────────────

// Known corp_code → stock_code mapping for major Korean stocks (avoids extra API call)
const KNOWN_CORP_CODES: Record<string, string> = {
  "005930": "00126380", // 삼성전자
  "000660": "00164779", // SK하이닉스
  "035420": "00266961", // NAVER
  "035720": "00258801", // 카카오
  "005380": "00164742", // 현대차
  "000270": "00106112", // 기아
  "373220": "01426586", // LG에너지솔루션
  "006400": "00126186", // 삼성SDI
  "068270": "00102455", // 셀트리온
  "207940": "00877059", // 삼성바이오로직스
  "326030": "01415543", // SK바이오팜
  "042700": "00181682", // 한미반도체
  "000990": "00126383", // DB하이텍
  "096770": "00631518", // SK이노베이션
  "247540": "01026222", // 에코프로비엠
  "041510": "00213888", // 에스엠
  "035900": "00281668", // JYP엔터
  "105560": "00293886", // KB금융
  "055550": "00382740", // 신한지주
  "086790": "00547583", // 하나금융지주
  "051910": "00194845", // LG화학
  "011170": "00137534", // 롯데케미칼
  "009830": "00162586", // 한화솔루션
  "000720": "00162606", // 현대건설
  "028260": "00126370", // 삼성물산
  "005490": "00158366", // POSCO홀딩스
  "004020": "00109461", // 현대제철
  "259960": "01264874", // 크래프톤
  "036570": "00214361", // NCsoft
  "263750": "01247174", // 펄어비스
  "012330": "00164668", // 현대모비스
};

// Get DART corp_code from 6-digit stock code.
// Uses hardcoded table first, then falls back to DART disclosure-list search.
export async function getCorpCode(stockCode: string): Promise<string | null> {
  const sc = stockCode.replace(/\.(KS|KQ)$/, "");
  if (_corpCache.has(sc)) return _corpCache.get(sc)!;

  // Fast path: known codes
  if (KNOWN_CORP_CODES[sc]) {
    _corpCache.set(sc, KNOWN_CORP_CODES[sc]);
    return KNOWN_CORP_CODES[sc];
  }

  // Slow path: search DART disclosure list (3-month window, returns corp_code in results)
  const key = dartKey();
  if (!key) return null;
  try {
    const now = new Date();
    const end = now.toISOString().slice(0, 10).replace(/-/g, "");
    const start = new Date(now.getTime() - 85 * 86400_000).toISOString().slice(0, 10).replace(/-/g, "");
    const url =
      `${DART_BASE}/list.json` +
      `?crtfc_key=${encodeURIComponent(key)}` +
      `&stock_code=${sc}` +
      `&bgn_de=${start}&end_de=${end}` +
      `&pblntf_ty=A&page_count=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    const json = await res.json() as { status: string; list?: Array<{ corp_code: string }> };
    if (json.status === "000" && json.list?.[0]?.corp_code) {
      const cc = json.list[0].corp_code;
      _corpCache.set(sc, cc);
      return cc;
    }
  } catch { /* ignore */ }
  return null;
}

// Fetch all financial statements for one corp / year / report type.
// Tries CFS (연결) first, falls back to OFS (별도) if CFS returns no data.
async function fetchStmts(
  corpCode: string,
  bsnsYear: string,
  reprtCode: string,
  fsdiv: "CFS" | "OFS" = "CFS",
): Promise<DartItem[]> {
  const cacheKey = `${corpCode}_${bsnsYear}_${reprtCode}_${fsdiv}`;
  const hit = _stmtCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < STMT_TTL) return hit.data;

  const key = dartKey();
  if (!key) throw new Error("DART API key missing");

  const url =
    `${DART_BASE}/fnlttSinglAcntAll.json` +
    `?crtfc_key=${encodeURIComponent(key)}` +
    `&corp_code=${corpCode}` +
    `&bsns_year=${bsnsYear}` +
    `&reprt_code=${reprtCode}` +
    `&fs_div=${fsdiv}`;

  const res  = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const json = await res.json() as DartListResponse;

  if (json.status === "000" && json.list?.length) {
    _stmtCache.set(cacheKey, { data: json.list, ts: Date.now() });
    return json.list;
  }

  // CFS failed → retry with OFS (standalone statements)
  if (fsdiv === "CFS") return fetchStmts(corpCode, bsnsYear, reprtCode, "OFS");
  throw new Error(`DART ${json.status}: ${json.message ?? "no data"} (${bsnsYear}/${reprtCode})`);
}

// ── Build annual row from a DartItem[] for one period ─────────────────────────

function buildAnnualRow(items: DartItem[], period: Period, label: string) {
  const rev  = findVal(items, period, "revenue");
  const gp   = findVal(items, period, "grossProfit");
  const op   = findVal(items, period, "opIncome");
  const ni   = findVal(items, period, "netIncome");
  const ta   = findVal(items, period, "totalAssets");
  const tl   = findVal(items, period, "totalLiabilities");
  const te   = findVal(items, period, "totalEquity");
  const ocf  = findVal(items, period, "opCF");
  const cx   = findVal(items, period, "capex");
  return { label, rev, gp, op, ni, ta, tl, te, ocf, cx };
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface DartAnnualRow {
  period:            string;
  revenue?:          number;
  grossProfit?:      number;
  operatingIncome?:  number;
  netIncome?:        number;
  totalAssets?:      number;
  totalLiabilities?: number;
  totalEquity?:      number;
  operatingCF?:      number;
  capex?:            number;
}

export interface DartQuarterRow {
  period:           string;
  revenue?:         number;
  operatingIncome?: number;
  netIncome?:       number;
  operatingCF?:     number;
  capex?:           number;
}

export interface DartFinancials {
  annual:    DartAnnualRow[];
  quarterly: DartQuarterRow[];
}

// ── Main fetch function ───────────────────────────────────────────────────────

export async function fetchDartKrFinancials(stockCode: string): Promise<DartFinancials> {
  const corpCode = await getCorpCode(stockCode);
  if (!corpCode) throw new Error(`Corp code not found for ${stockCode}`);

  // ── Year calculation ──────────────────────────────────────────────────────
  // May 2026: FY2025 annual reports are available (filed March 2026)
  const now         = new Date();
  const curYear     = now.getFullYear();
  // Most recent completed fiscal year (assume Dec-31 FY end; annual filed by April)
  const recentFY    = now.getMonth() >= 3 ? curYear - 1 : curYear - 2;
  const olderFY     = recentFY - 2; // gives bfefrmtrm = recentFY-4

  // ── Parallel fetches ──────────────────────────────────────────────────────
  // annual1: recentFY annual → rows for recentFY / recentFY-1 / recentFY-2
  // annual2: olderFY annual  → rows for olderFY   / olderFY-1  / olderFY-2 (get olderFY-1 = recentFY-3)
  // q1/h1/q3: quarterly reports for recentFY
  const [r_ann, r_old, r_q1, r_h1, r_q3] = await Promise.allSettled([
    fetchStmts(corpCode, String(recentFY),   "11011"),   // Annual, recent
    fetchStmts(corpCode, String(olderFY),    "11011"),   // Annual, older
    fetchStmts(corpCode, String(recentFY),   "11013"),   // Q1
    fetchStmts(corpCode, String(recentFY),   "11012"),   // H1
    fetchStmts(corpCode, String(recentFY),   "11014"),   // Q3 YTD
  ]);

  const annRecent = r_ann.status === "fulfilled" ? r_ann.value : null;
  const annOlder  = r_old.status === "fulfilled" ? r_old.value : null;

  if (!annRecent && !annOlder) throw new Error("DART: no annual data returned");

  // ── Build annual rows ─────────────────────────────────────────────────────
  // Collect year-indexed map to deduplicate
  const yearMap = new Map<string, ReturnType<typeof buildAnnualRow>>();

  if (annRecent) {
    for (const [p, yr] of [
      ["thstrm",   recentFY],
      ["frmtrm",   recentFY - 1],
      ["bfefrmtrm",recentFY - 2],
    ] as [Period, number][]) {
      const row = buildAnnualRow(annRecent, p, String(yr));
      if (row.rev) yearMap.set(String(yr), row);
    }
  }

  if (annOlder) {
    for (const [p, yr] of [
      ["thstrm",   olderFY],
      ["frmtrm",   olderFY - 1],
    ] as [Period, number][]) {
      const row = buildAnnualRow(annOlder, p, String(yr));
      if (row.rev && !yearMap.has(String(yr))) yearMap.set(String(yr), row);
    }
  }

  const toAnnual = (r: ReturnType<typeof buildAnnualRow>): DartAnnualRow => ({
    period:            r.label,
    revenue:           r.rev,
    grossProfit:       r.gp,
    operatingIncome:   r.op,
    netIncome:         r.ni,
    totalAssets:       r.ta,
    totalLiabilities:  r.tl,
    totalEquity:       r.te,
    operatingCF:       r.ocf,
    capex:             r.cx !== undefined ? -Math.abs(r.cx) : undefined,
  });

  const annual: DartAnnualRow[] = [...yearMap.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-4)
    .map(toAnnual);

  if (!annual.length) throw new Error("DART: empty annual rows after parsing");

  // ── Build quarterly rows ──────────────────────────────────────────────────
  const quarterly: DartQuarterRow[] = [];
  const yrSfx = String(recentFY).slice(2); // "25"

  const q1Items  = r_q1.status === "fulfilled" ? r_q1.value : null;
  const h1Items  = r_h1.status === "fulfilled" ? r_h1.value : null;
  const q3Items  = r_q3.status === "fulfilled" ? r_q3.value : null;

  if (q1Items && h1Items && q3Items && annRecent) {
    const g = (items: DartItem[], k: string) => findVal(items, "thstrm", k);

    // DART quarterly thstrm_amount = standalone period (Q1=Jan-Mar, H1=Q2 Apr-Jun, Q3=Jul-Sep)
    const q1r = g(q1Items, "revenue"),  q1o = g(q1Items, "opIncome"),  q1n = g(q1Items, "netIncome"),  q1c = g(q1Items, "opCF");
    const q2r = g(h1Items, "revenue"),  q2o = g(h1Items, "opIncome"),  q2n = g(h1Items, "netIncome"),  q2c = g(h1Items, "opCF");
    const q3r = g(q3Items, "revenue"),  q3o = g(q3Items, "opIncome"),  q3n = g(q3Items, "netIncome"),  q3c = g(q3Items, "opCF");
    const anr = g(annRecent, "revenue"),ano = g(annRecent,"opIncome"), ann = g(annRecent,"netIncome"),  anc = g(annRecent,"opCF");

    // Q4 = Annual - (Q1 + Q2 + Q3)
    const q4 = (total?: number, a?: number, b?: number, c?: number) =>
      (total !== undefined && a !== undefined && b !== undefined && c !== undefined)
        ? total - a - b - c : undefined;

    quarterly.push({ period: `${yrSfx}Q1`, revenue: q1r, operatingIncome: q1o, netIncome: q1n, operatingCF: q1c });
    quarterly.push({ period: `${yrSfx}Q2`, revenue: q2r, operatingIncome: q2o, netIncome: q2n, operatingCF: q2c });
    quarterly.push({ period: `${yrSfx}Q3`, revenue: q3r, operatingIncome: q3o, netIncome: q3n, operatingCF: q3c });
    quarterly.push({ period: `${yrSfx}Q4`,
      revenue:         q4(anr, q1r, q2r, q3r),
      operatingIncome: q4(ano, q1o, q2o, q3o),
      netIncome:       q4(ann, q1n, q2n, q3n),
      operatingCF:     q4(anc, q1c, q2c, q3c),
    });

  } else if (annRecent) {
    // Only annual available — split evenly across 4 quarters as a rough estimate
    const anr = findVal(annRecent, "thstrm", "revenue");
    const ano = findVal(annRecent, "thstrm", "opIncome");
    const ann2 = findVal(annRecent, "thstrm", "netIncome");
    const q4 = (v?: number) => (v !== undefined ? Math.round(v / 4) : undefined);
    for (const q of [1, 2, 3, 4]) {
      quarterly.push({ period: `${yrSfx}Q${q}`, revenue: q4(anr), operatingIncome: q4(ano), netIncome: q4(ann2) });
    }
  }

  return { annual, quarterly };
}

// ── DART corp list (corpCode.xml) ─────────────────────────────────────────────
// Downloads the master list of every company registered with DART. Used to
// search Korean smallcaps (KOSDAQ etc.) that Yahoo Finance search doesn't index
// for Hangul queries.

export interface DartCorp {
  corpCode:  string; // 8-digit DART code
  corpName:  string; // Korean company name
  stockCode: string; // 6-digit listed stock code (empty for unlisted)
}

// Minimal ZIP extractor — DART returns a ZIP containing exactly one file
// (CORPCODE.xml). DART uses the data-descriptor variant (flag bit 3), so the
// compressed/uncompressed sizes in the local file header are zero and the real
// sizes live in the central directory. We locate the EOCD record, follow it to
// the central directory entry, and read sizes from there.
function unzipFirst(buffer: Buffer): Buffer {
  // 1) Find End-of-Central-Directory record (PK\x05\x06). Scan backwards over
  // the last 64 KiB + 22-byte EOCD payload — the variable-length comment field
  // means the EOCD can be anywhere in that window.
  let eocdPos = -1;
  const searchStart = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocdPos = i; break; }
  }
  if (eocdPos < 0) throw new Error("ZIP: end-of-central-directory not found");

  // 2) Central-directory header (PK\x01\x02) — read true sizes here.
  const cdOffset = buffer.readUInt32LE(eocdPos + 16);
  if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) {
    throw new Error("ZIP: central directory signature mismatch");
  }
  const compression    = buffer.readUInt16LE(cdOffset + 10);
  const compressedSize = buffer.readUInt32LE(cdOffset + 20);
  const localHdrOffset = buffer.readUInt32LE(cdOffset + 42);

  // 3) Skip past the local file header to get to the compressed payload.
  if (buffer.readUInt32LE(localHdrOffset) !== 0x04034b50) {
    throw new Error("ZIP: local file header signature mismatch");
  }
  const lfhNameLen  = buffer.readUInt16LE(localHdrOffset + 26);
  const lfhExtraLen = buffer.readUInt16LE(localHdrOffset + 28);
  const dataStart   = localHdrOffset + 30 + lfhNameLen + lfhExtraLen;
  const compressed  = buffer.subarray(dataStart, dataStart + compressedSize);

  if (compression === 0) return compressed;            // STORED
  if (compression === 8) return inflateRawSync(compressed); // DEFLATE
  throw new Error(`ZIP: unsupported compression method ${compression}`);
}

async function downloadCorpList(): Promise<DartCorp[]> {
  const key = dartKey();
  if (!key) throw new Error("DART API key missing");

  const url = `${DART_BASE}/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`;
  // Give DART up to 45 s on cold start — the file is 3.5 MB compressed and
  // DART can be slow to respond from Vercel's egress regions.
  const t0 = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000), cache: "no-store" });
  if (!res.ok) throw new Error(`DART corpCode HTTP ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  const zipBuf = Buffer.from(arrayBuf);
  console.info(`[dart] corpCode ZIP downloaded ${zipBuf.length} B in ${Date.now() - t0} ms`);
  const xml = unzipFirst(zipBuf).toString("utf-8");
  console.info(`[dart] corpCode XML extracted ${xml.length} B`);

  // XML is ~28 MB with ~118 k <list> blocks. Block-based parsing is robust to
  // field order/whitespace and the fact that DART encodes "no stock code" as
  // a single space character (" ") inside the <stock_code> tag.
  const corps: DartCorp[] = [];
  const listBlockRe = /<list>([\s\S]*?)<\/list>/g;
  const codeRe = /<corp_code>([^<]*)<\/corp_code>/;
  const nameRe = /<corp_name>([^<]*)<\/corp_name>/;
  const stkRe  = /<stock_code>([^<]*)<\/stock_code>/;
  let m: RegExpExecArray | null;
  while ((m = listBlockRe.exec(xml)) !== null) {
    const block     = m[1];
    const stockCode = stkRe.exec(block)?.[1]?.trim() ?? "";
    if (!stockCode) continue; // Skip unlisted corps (DART stores " " for unlisted)
    const corpCode  = codeRe.exec(block)?.[1]?.trim() ?? "";
    const corpName  = nameRe.exec(block)?.[1]?.trim() ?? "";
    if (!corpCode || !corpName) continue;
    corps.push({ corpCode, corpName, stockCode });
  }
  return corps;
}

export async function fetchDartCorpList(): Promise<DartCorp[]> {
  const now = Date.now();
  if (_corpListCache && now - _corpListCache.ts < CORP_LIST_TTL) {
    return _corpListCache.list;
  }
  // De-dupe concurrent calls during cold start
  if (_corpListPromise) return _corpListPromise;
  _corpListPromise = downloadCorpList()
    .then(list => {
      _corpListCache = { list, ts: Date.now() };
      // Warm corpCode cache too (so getCorpCode skips the disclosure-list lookup)
      for (const c of list) {
        if (!_corpCache.has(c.stockCode)) _corpCache.set(c.stockCode, c.corpCode);
      }
      console.info(`[dart] corp list ready: ${list.length} listed corps`);
      return list;
    })
    .catch(err => {
      console.error(`[dart] corp list fetch failed:`, (err as Error).message);
      throw err;
    })
    .finally(() => { _corpListPromise = null; });
  return _corpListPromise;
}

export interface DartCorpSearchHit {
  stockCode: string;
  corpName:  string;
  corpCode:  string;
}

// Search the DART corp list by Korean name or 6-digit stock code.
// Returns the top `limit` hits, ordered: exact-prefix > contains.
export async function searchDartCorps(query: string, limit = 10): Promise<DartCorpSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  let list: DartCorp[];
  try {
    list = await fetchDartCorpList();
  } catch {
    return [];
  }

  const lq = q.toLowerCase();
  const isNumeric = /^\d{1,6}$/.test(q);

  // Score: 3=exact name/code, 2=prefix name, 1=contains
  const scored: { hit: DartCorpSearchHit; score: number }[] = [];
  for (const c of list) {
    let score = 0;
    if (isNumeric) {
      if (c.stockCode === q.padStart(6, "0")) score = 3;
      else if (c.stockCode.startsWith(q))     score = 2;
      else if (c.stockCode.includes(q))       score = 1;
    } else {
      const name = c.corpName.toLowerCase();
      if (name === lq)              score = 3;
      else if (name.startsWith(lq)) score = 2;
      else if (name.includes(lq))   score = 1;
    }
    if (score > 0) {
      scored.push({
        hit: { stockCode: c.stockCode, corpName: c.corpName, corpCode: c.corpCode },
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.hit.corpName.localeCompare(b.hit.corpName));
  return scored.slice(0, limit).map(s => s.hit);
}
