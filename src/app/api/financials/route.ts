import { NextRequest } from "next/server";
import type { FinancialData, FinancialReport } from "@/types/financial";
import { fetchYFFinancials, resolveKrYahooSymbol, type YFIncomeRow, type YFBalanceRow, type YFCashFlowRow } from "@/lib/yahoo-finance";
import { fetchDartKrFinancials } from "@/lib/dart";

export const runtime = "nodejs";

// ── In-memory cache (24h TTL) ──────────────────────────────────────────────
const cache = new Map<string, { data: FinancialData; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1_000;

// ── Korean mock data ────────────────────────────────────────────────────────
// 단위: 억원

type KoreanAnnual = {
  period: string;
  revenue: number; grossProfit: number; operatingIncome: number;
  netIncome: number; ebitda: number;
  totalAssets: number; totalLiabilities: number; totalEquity: number;
  operatingCF: number; capex: number;
};

type KoreanQ = {
  period: string;
  revenue: number; operatingIncome: number; netIncome: number;
};

const KR_MOCK: Record<string, { name: string; annual: KoreanAnnual[]; quarterly: KoreanQ[] }> = {
  "005930": {
    name: "삼성전자",
    annual: [
      { period:"2021", revenue:2_796_048, grossProfit:1_061_632, operatingIncome:516_339, netIncome:399_073, ebitda:820_000, totalAssets:4_261_794, totalLiabilities:1_029_575, totalEquity:2_954_875, operatingCF:659_671, capex:-488_043 },
      { period:"2022", revenue:3_022_314, grossProfit:1_147_823, operatingIncome:434_477, netIncome:554_874, ebitda:728_000, totalAssets:4_482_905, totalLiabilities:1_212_145, totalEquity:2_977_350, operatingCF:431_018, capex:-530_451 },
      { period:"2023", revenue:2_589_355, grossProfit:636_476,   operatingIncome:-66_462, netIncome:154_789, ebitda:221_000, totalAssets:4_558_297, totalLiabilities:1_069_048, totalEquity:2_897_892, operatingCF:476_027, capex:-530_737 },
      { period:"2024", revenue:3_001_832, grossProfit:1_054_421, operatingIncome:328_700, netIncome:344_000, ebitda:618_000, totalAssets:4_789_000, totalLiabilities:1_120_000, totalEquity:3_052_000, operatingCF:548_000, capex:-482_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:710_000, operatingIncome:62_000,  netIncome:66_000  },
      { period:"24Q2", revenue:740_000, operatingIncome:104_000, netIncome:97_000  },
      { period:"24Q3", revenue:790_000, operatingIncome:91_800,  netIncome:90_000  },
      { period:"24Q4", revenue:761_000, operatingIncome:68_800,  netIncome:91_000  },
    ],
  },
  "000660": {
    name: "SK하이닉스",
    annual: [
      { period:"2021", revenue:425_935, grossProfit:182_671, operatingIncome:127_660, netIncome:97_293,  ebitda:195_000, totalAssets:904_428,   totalLiabilities:446_818, totalEquity:424_600, operatingCF:135_645, capex:-170_000 },
      { period:"2022", revenue:447_030, grossProfit:136_819, operatingIncome:7_658,   netIncome:-32_817, ebitda:126_000, totalAssets:979_408,   totalLiabilities:520_368, totalEquity:426_000, operatingCF:97_000,  capex:-200_000 },
      { period:"2023", revenue:326_047, grossProfit:19_381,  operatingIncome:-73_044, netIncome:-78_885, ebitda:85_000,  totalAssets:1_018_064, totalLiabilities:574_864, totalEquity:443_200, operatingCF:120_000, capex:-150_000 },
      { period:"2024", revenue:663_486, grossProfit:318_100, operatingIncome:234_126, netIncome:191_895, ebitda:370_000, totalAssets:1_150_000, totalLiabilities:640_000, totalEquity:510_000, operatingCF:290_000, capex:-160_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:123_000, operatingIncome:23_000,  netIncome:17_000  },
      { period:"24Q2", revenue:162_000, operatingIncome:55_000,  netIncome:43_000  },
      { period:"24Q3", revenue:175_000, operatingIncome:71_000,  netIncome:58_000  },
      { period:"24Q4", revenue:203_000, operatingIncome:85_126,  netIncome:73_895  },
    ],
  },
  "035420": {
    name: "NAVER",
    annual: [
      { period:"2021", revenue:67_992, grossProfit:30_123, operatingIncome:13_252, netIncome:18_975, ebitda:18_400, totalAssets:130_847, totalLiabilities:71_259,  totalEquity:59_588, operatingCF:21_200, capex:-7_800  },
      { period:"2022", revenue:82_006, grossProfit:35_442, operatingIncome:11_671, netIncome:10_252, ebitda:16_100, totalAssets:260_942, totalLiabilities:176_345, totalEquity:84_597, operatingCF:18_300, capex:-12_100 },
      { period:"2023", revenue:96_706, grossProfit:43_118, operatingIncome:14_942, netIncome:11_623, ebitda:20_800, totalAssets:271_000, totalLiabilities:178_000, totalEquity:93_000, operatingCF:22_400, capex:-14_700 },
      { period:"2024", revenue:104_000, grossProfit:47_200, operatingIncome:16_000, netIncome:13_000, ebitda:22_000, totalAssets:285_000, totalLiabilities:183_000, totalEquity:102_000, operatingCF:24_000, capex:-13_500 },
    ],
    quarterly: [
      { period:"24Q1", revenue:24_500, operatingIncome:3_700, netIncome:3_000 },
      { period:"24Q2", revenue:25_800, operatingIncome:4_100, netIncome:3_400 },
      { period:"24Q3", revenue:26_900, operatingIncome:4_300, netIncome:3_600 },
      { period:"24Q4", revenue:26_800, operatingIncome:3_900, netIncome:3_000 },
    ],
  },
  "035720": {
    name: "카카오",
    annual: [
      { period:"2021", revenue:61_888, grossProfit:33_014, operatingIncome:5_829,  netIncome:28_942, ebitda:10_400, totalAssets:167_948, totalLiabilities:78_241, totalEquity:89_707, operatingCF:8_100,  capex:-5_200 },
      { period:"2022", revenue:73_061, grossProfit:37_620, operatingIncome:6_534,  netIncome:5_131,  ebitda:12_200, totalAssets:282_471, totalLiabilities:139_724, totalEquity:142_747, operatingCF:9_800,  capex:-8_700 },
      { period:"2023", revenue:78_499, grossProfit:38_982, operatingIncome:5_201,  netIncome:-4_027, ebitda:9_800,  totalAssets:285_000, totalLiabilities:141_000, totalEquity:144_000, operatingCF:7_200,  capex:-9_100 },
      { period:"2024", revenue:80_000, grossProfit:39_500, operatingIncome:4_800,  netIncome:-2_100, ebitda:9_200,  totalAssets:280_000, totalLiabilities:138_000, totalEquity:142_000, operatingCF:6_800,  capex:-7_800 },
    ],
    quarterly: [
      { period:"24Q1", revenue:19_500, operatingIncome:1_050, netIncome:-300  },
      { period:"24Q2", revenue:20_100, operatingIncome:1_200, netIncome:-800  },
      { period:"24Q3", revenue:20_600, operatingIncome:1_350, netIncome:-500  },
      { period:"24Q4", revenue:19_800, operatingIncome:1_200, netIncome:-500  },
    ],
  },
  "373220": {
    name: "LG에너지솔루션",
    annual: [
      { period:"2021", revenue:178_519, grossProfit:16_847, operatingIncome:7_685,  netIncome:4_887,  ebitda:25_100, totalAssets:247_394, totalLiabilities:138_012, totalEquity:109_382, operatingCF:14_500, capex:-42_000 },
      { period:"2022", revenue:257_572, grossProfit:28_346, operatingIncome:12_127, netIncome:7_942,  ebitda:32_000, totalAssets:385_000, totalLiabilities:237_000, totalEquity:148_000, operatingCF:18_200, capex:-67_000 },
      { period:"2023", revenue:336_802, grossProfit:48_524, operatingIncome:22_622, netIncome:14_779, ebitda:48_000, totalAssets:470_000, totalLiabilities:277_000, totalEquity:193_000, operatingCF:22_800, capex:-88_000 },
      { period:"2024", revenue:268_000, grossProfit:22_000, operatingIncome:6_200,  netIncome:2_000,  ebitda:32_000, totalAssets:500_000, totalLiabilities:295_000, totalEquity:205_000, operatingCF:15_000, capex:-75_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:62_000, operatingIncome:1_574, netIncome:240    },
      { period:"24Q2", revenue:68_000, operatingIncome:1_952, netIncome:520    },
      { period:"24Q3", revenue:70_000, operatingIncome:1_480, netIncome:570    },
      { period:"24Q4", revenue:68_000, operatingIncome:1_194, netIncome:670    },
    ],
  },
  "005380": {
    name: "현대차",
    annual: [
      { period:"2021", revenue:1_175_231, grossProfit:196_281, operatingIncome:66_679, netIncome:56_421, ebitda:148_000, totalAssets:2_431_000, totalLiabilities:1_892_000, totalEquity:539_000, operatingCF:95_000,  capex:-43_000 },
      { period:"2022", revenue:1_425_220, grossProfit:251_321, operatingIncome:102_965, netIncome:80_543, ebitda:185_000, totalAssets:2_710_000, totalLiabilities:2_105_000, totalEquity:605_000, operatingCF:117_000, capex:-49_000 },
      { period:"2023", revenue:1_623_566, grossProfit:315_441, operatingIncome:151_269, netIncome:122_871, ebitda:228_000, totalAssets:2_950_000, totalLiabilities:2_270_000, totalEquity:680_000, operatingCF:138_000, capex:-55_000 },
      { period:"2024", revenue:1_640_000, grossProfit:310_000, operatingIncome:138_000, netIncome:110_000, ebitda:218_000, totalAssets:3_100_000, totalLiabilities:2_390_000, totalEquity:710_000, operatingCF:145_000, capex:-58_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:400_000, operatingIncome:34_000, netIncome:27_000 },
      { period:"24Q2", revenue:420_000, operatingIncome:36_000, netIncome:29_000 },
      { period:"24Q3", revenue:410_000, operatingIncome:33_000, netIncome:26_000 },
      { period:"24Q4", revenue:410_000, operatingIncome:35_000, netIncome:28_000 },
    ],
  },
};

// Generic mock for unknown Korean stocks
function generateKrMock(symbol: string, name: string): FinancialData {
  const base = 50_000 + (parseInt(symbol.slice(-4), 10) % 200_000);
  const gr = 1.08;
  const annual: FinancialReport[] = ["2021","2022","2023","2024"].map((y, i) => {
    const rev = Math.round(base * Math.pow(gr, i));
    const op  = Math.round(rev * 0.09);
    const ni  = Math.round(rev * 0.06);
    const ta  = Math.round(rev * 3.2);
    const tl  = Math.round(ta  * 0.45);
    const te  = ta - tl;
    const cf  = Math.round(rev * 0.11);
    const cx  = -Math.round(rev * 0.07);
    return {
      period: y,
      revenue: rev, grossProfit: Math.round(rev * 0.28),
      operatingIncome: op, operatingMargin: 9,
      netIncome: ni, netMargin: 6,
      ebitda: Math.round(rev * 0.14),
      totalAssets: ta, totalLiabilities: tl, totalEquity: te,
      debtRatio: Math.round((tl / te) * 100),
      operatingCashFlow: cf, capex: cx, freeCashFlow: cf + cx,
    };
  });
  const quarterly: FinancialReport[] = ["24Q1","24Q2","24Q3","24Q4"].map(p => {
    const rev = Math.round(annual[3].revenue! / 4);
    return {
      period: p,
      revenue: rev, operatingIncome: Math.round(rev * 0.09),
      operatingMargin: 9, netIncome: Math.round(rev * 0.06), netMargin: 6,
    };
  });
  return { symbol, name, market:"KR", currency:"KRW", unit:"억원", annual, quarterly, isMock: true };
}

function buildFromKrMock(symbol: string): FinancialData | null {
  const entry = KR_MOCK[symbol];
  if (!entry) return null;

  const annual: FinancialReport[] = entry.annual.map(r => {
    const opMargin  = r.revenue ? (r.operatingIncome / r.revenue) * 100 : 0;
    const netMargin = r.revenue ? (r.netIncome        / r.revenue) * 100 : 0;
    const debtRatio = r.totalEquity ? (r.totalLiabilities / r.totalEquity) * 100 : 0;
    return {
      period:           r.period,
      revenue:          r.revenue,
      grossProfit:      r.grossProfit,
      operatingIncome:  r.operatingIncome,
      operatingMargin:  Math.round(opMargin * 10) / 10,
      netIncome:        r.netIncome,
      netMargin:        Math.round(netMargin * 10) / 10,
      ebitda:           r.ebitda,
      totalAssets:      r.totalAssets,
      totalLiabilities: r.totalLiabilities,
      totalEquity:      r.totalEquity,
      debtRatio:        Math.round(debtRatio),
      operatingCashFlow: r.operatingCF,
      capex:            r.capex,
      freeCashFlow:     r.operatingCF + r.capex,
    };
  });

  const quarterly: FinancialReport[] = entry.quarterly.map(r => ({
    period:          r.period,
    revenue:         r.revenue,
    operatingIncome: r.operatingIncome,
    operatingMargin: r.revenue ? Math.round((r.operatingIncome / r.revenue) * 1000) / 10 : 0,
    netIncome:       r.netIncome,
    netMargin:       r.revenue ? Math.round((r.netIncome / r.revenue) * 1000) / 10 : 0,
  }));

  return { symbol, name: entry.name, market:"KR", currency:"KRW", unit:"억원", annual, quarterly, isMock: true };
}

// ── US stock presets (fallback when AV is rate-limited) ────────────────────
// 단위: 백만달러

type USAnnual = {
  period: string;
  revenue: number; grossProfit: number; operatingIncome: number;
  netIncome: number; ebitda: number;
  totalAssets: number; totalLiabilities: number; totalEquity: number;
  operatingCF: number; capex: number;
};

type USQ = {
  period: string;
  revenue: number; operatingIncome: number; netIncome: number;
  operatingCF: number; capex: number;
};

const US_MOCK: Record<string, { name: string; annual: USAnnual[]; quarterly: USQ[] }> = {
  "AAPL": {
    name: "Apple",
    annual: [
      { period:"2021", revenue:365_817, grossProfit:152_836, operatingIncome:108_949, netIncome:94_680,  ebitda:120_233, totalAssets:351_002, totalLiabilities:287_912, totalEquity:63_090,  operatingCF:104_038, capex:-11_085 },
      { period:"2022", revenue:394_328, grossProfit:170_782, operatingIncome:119_437, netIncome:99_803,  ebitda:130_541, totalAssets:352_755, totalLiabilities:302_083, totalEquity:50_672,  operatingCF:122_151, capex:-10_708 },
      { period:"2023", revenue:383_285, grossProfit:169_148, operatingIncome:114_301, netIncome:96_995,  ebitda:125_820, totalAssets:352_583, totalLiabilities:290_437, totalEquity:62_146,  operatingCF:110_543, capex:-10_959 },
      { period:"2024", revenue:391_035, grossProfit:180_683, operatingIncome:123_216, netIncome:93_736,  ebitda:134_661, totalAssets:364_980, totalLiabilities:308_030, totalEquity:56_950,  operatingCF:118_254, capex:-9_447  },
    ],
    quarterly: [
      { period:"24Q1", revenue:119_575, operatingIncome:41_976, netIncome:33_916, operatingCF:39_497, capex:-2_540 },
      { period:"24Q2", revenue:85_777,  operatingIncome:23_640, netIncome:21_448, operatingCF:28_370, capex:-2_160 },
      { period:"24Q3", revenue:94_930,  operatingIncome:29_590, netIncome:14_736, operatingCF:25_190, capex:-2_443 },
      { period:"24Q4", revenue:124_300, operatingIncome:36_970, netIncome:36_330, operatingCF:36_000, capex:-2_500 },
    ],
  },
  "MSFT": {
    name: "Microsoft",
    annual: [
      { period:"2021", revenue:168_088, grossProfit:115_856, operatingIncome:69_916, netIncome:61_271, ebitda:85_135, totalAssets:333_779, totalLiabilities:191_791, totalEquity:141_988, operatingCF:76_740, capex:-20_622 },
      { period:"2022", revenue:198_270, grossProfit:135_620, operatingIncome:83_383, netIncome:72_738, ebitda:100_239, totalAssets:364_840, totalLiabilities:198_298, totalEquity:166_542, operatingCF:89_035, capex:-23_886 },
      { period:"2023", revenue:211_915, grossProfit:146_052, operatingIncome:88_523, netIncome:72_361, ebitda:105_353, totalAssets:411_976, totalLiabilities:205_753, totalEquity:206_223, operatingCF:87_582, capex:-28_107 },
      { period:"2024", revenue:245_122, grossProfit:171_008, operatingIncome:109_433, netIncome:88_136, ebitda:130_672, totalAssets:512_163, totalLiabilities:243_686, totalEquity:268_477, operatingCF:118_548, capex:-44_482 },
    ],
    quarterly: [
      { period:"24Q1", revenue:61_858, operatingIncome:27_582, netIncome:21_939, operatingCF:31_903, capex:-10_237 },
      { period:"24Q2", revenue:64_727, operatingIncome:27_925, netIncome:22_036, operatingCF:29_095, capex:-13_866 },
      { period:"24Q3", revenue:65_585, operatingIncome:27_048, netIncome:22_291, operatingCF:34_180, capex:-14_039 },
      { period:"24Q4", revenue:69_632, operatingIncome:32_313, netIncome:24_667, operatingCF:34_240, capex:-14_923 },
    ],
  },
  "NVDA": {
    name: "NVIDIA",
    annual: [
      { period:"2021", revenue:16_675,  grossProfit:10_396,  operatingIncome:4_532,  netIncome:4_332,  ebitda:5_643,  totalAssets:44_187,  totalLiabilities:19_227,  totalEquity:24_960,  operatingCF:5_822,  capex:-1_128 },
      { period:"2022", revenue:26_974,  grossProfit:17_475,  operatingIncome:10_041, netIncome:9_752,  ebitda:11_430, totalAssets:41_172,  totalLiabilities:17_575,  totalEquity:26_612,  operatingCF:9_108,  capex:-976  },
      { period:"2023", revenue:26_974,  grossProfit:15_356,  operatingIncome:5_577,  netIncome:4_368,  ebitda:6_921,  totalAssets:41_292,  totalLiabilities:19_081,  totalEquity:22_101,  operatingCF:5_641,  capex:-1_833 },
      { period:"2024", revenue:60_922,  grossProfit:44_301,  operatingIncome:32_972, netIncome:29_760, ebitda:34_712, totalAssets:65_728,  totalLiabilities:27_022,  totalEquity:42_978,  operatingCF:28_083, capex:-1_069 },
    ],
    quarterly: [
      { period:"24Q1", revenue:22_103,  operatingIncome:16_900, netIncome:14_881, operatingCF:11_559, capex:-369  },
      { period:"24Q2", revenue:30_040,  operatingIncome:18_642, netIncome:16_599, operatingCF:14_489, capex:-391  },
      { period:"24Q3", revenue:35_082,  operatingIncome:21_869, netIncome:19_309, operatingCF:17_637, capex:-396  },
      { period:"24Q4", revenue:39_331,  operatingIncome:23_521, netIncome:22_091, operatingCF:16_764, capex:-416  },
    ],
  },
  "GOOGL": {
    name: "Alphabet",
    annual: [
      { period:"2021", revenue:257_637, grossProfit:146_698, operatingIncome:78_714, netIncome:76_033, ebitda:97_434, totalAssets:359_268, totalLiabilities:97_072, totalEquity:251_635, operatingCF:91_652, capex:-24_173 },
      { period:"2022", revenue:282_836, grossProfit:156_633, operatingIncome:74_842, netIncome:59_972, ebitda:95_213, totalAssets:359_268, totalLiabilities:109_120, totalEquity:256_144, operatingCF:91_495, capex:-31_485 },
      { period:"2023", revenue:307_394, grossProfit:174_062, operatingIncome:84_293, netIncome:73_795, ebitda:104_742, totalAssets:402_392, totalLiabilities:119_013, totalEquity:283_379, operatingCF:101_746, capex:-32_251 },
      { period:"2024", revenue:350_018, grossProfit:210_350, operatingIncome:112_390, netIncome:100_118, ebitda:134_268, totalAssets:450_000, totalLiabilities:125_000, totalEquity:325_000, operatingCF:125_000, capex:-40_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:80_539,  operatingIncome:25_472, netIncome:23_662, operatingCF:23_653, capex:-12_006 },
      { period:"24Q2", revenue:84_742,  operatingIncome:27_425, netIncome:23_619, operatingCF:22_838, capex:-13_174 },
      { period:"24Q3", revenue:88_268,  operatingIncome:28_000, netIncome:26_301, operatingCF:30_613, capex:-13_062 },
      { period:"24Q4", revenue:96_469,  operatingIncome:30_905, netIncome:26_536, operatingCF:32_781, capex:-14_298 },
    ],
  },
  "AMZN": {
    name: "Amazon",
    annual: [
      { period:"2021", revenue:469_822, grossProfit:197_478, operatingIncome:24_879, netIncome:33_364,  ebitda:66_987, totalAssets:420_549, totalLiabilities:282_304, totalEquity:138_245, operatingCF:46_327,  capex:-61_053 },
      { period:"2022", revenue:513_983, grossProfit:225_152, operatingIncome:-2_847, netIncome:-2_722,  ebitda:40_016, totalAssets:462_675, totalLiabilities:316_633, totalEquity:146_043, operatingCF:-1_785,  capex:-63_645 },
      { period:"2023", revenue:574_785, grossProfit:270_013, operatingIncome:36_852, netIncome:30_425,  ebitda:83_152, totalAssets:527_854, totalLiabilities:325_981, totalEquity:201_875, operatingCF:84_946,  capex:-52_729 },
      { period:"2024", revenue:637_959, grossProfit:323_506, operatingIncome:68_594, netIncome:59_248,  ebitda:117_500, totalAssets:624_894, totalLiabilities:370_000, totalEquity:254_894, operatingCF:115_000, capex:-77_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:143_313, operatingIncome:15_307, netIncome:10_431, operatingCF:31_884, capex:-17_616 },
      { period:"24Q2", revenue:148_000, operatingIncome:14_674, netIncome:13_485, operatingCF:25_039, capex:-18_397 },
      { period:"24Q3", revenue:158_877, operatingIncome:17_411, netIncome:15_328, operatingCF:30_054, capex:-22_620 },
      { period:"24Q4", revenue:187_791, operatingIncome:21_202, netIncome:20_004, operatingCF:34_068, capex:-26_284 },
    ],
  },
  "TSLA": {
    name: "Tesla",
    annual: [
      { period:"2021", revenue:53_823,  grossProfit:13_656,  operatingIncome:6_523,  netIncome:5_519,  ebitda:9_641,  totalAssets:62_131,  totalLiabilities:30_548,  totalEquity:30_189,  operatingCF:11_497, capex:-8_000  },
      { period:"2022", revenue:81_462,  grossProfit:20_853,  operatingIncome:13_656, netIncome:12_556, ebitda:17_638, totalAssets:82_338,  totalLiabilities:36_440,  totalEquity:44_704,  operatingCF:14_485, capex:-7_158  },
      { period:"2023", revenue:96_773,  grossProfit:17_660,  operatingIncome:8_891,  netIncome:14_974, ebitda:14_382, totalAssets:106_618, totalLiabilities:43_009,  totalEquity:62_634,  operatingCF:13_256, capex:-8_898  },
      { period:"2024", revenue:97_690,  grossProfit:19_800,  operatingIncome:7_083,  netIncome:7_090,  ebitda:12_700, totalAssets:119_000, totalLiabilities:48_000,  totalEquity:71_000,  operatingCF:14_923, capex:-11_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:21_301, operatingIncome:1_171, netIncome:1_129, operatingCF:3_353, capex:-2_774 },
      { period:"24Q2", revenue:25_182, operatingIncome:1_600, netIncome:1_478, operatingCF:3_612, capex:-2_271 },
      { period:"24Q3", revenue:25_182, operatingIncome:2_717, netIncome:2_167, operatingCF:6_255, capex:-3_513 },
      { period:"24Q4", revenue:25_707, operatingIncome:1_595, netIncome:2_316, operatingCF:4_634, capex:-3_200 },
    ],
  },
  "META": {
    name: "Meta Platforms",
    annual: [
      { period:"2021", revenue:117_929, grossProfit:97_627,  operatingIncome:46_753, netIncome:39_370, ebitda:56_279, totalAssets:165_987, totalLiabilities:31_368,  totalEquity:124_879, operatingCF:57_683, capex:-19_244 },
      { period:"2022", revenue:116_609, grossProfit:94_017,  operatingIncome:28_944, netIncome:23_200, ebitda:40_244, totalAssets:165_987, totalLiabilities:44_784,  totalEquity:125_397, operatingCF:50_475, capex:-31_431 },
      { period:"2023", revenue:134_902, grossProfit:111_798, operatingIncome:46_751, netIncome:39_098, ebitda:58_051, totalAssets:229_623, totalLiabilities:51_485,  totalEquity:153_168, operatingCF:71_113, capex:-28_101 },
      { period:"2024", revenue:164_501, grossProfit:141_367, operatingIncome:68_850, netIncome:62_360, ebitda:82_100, totalAssets:276_000, totalLiabilities:57_000,  totalEquity:219_000, operatingCF:93_000, capex:-38_000 },
    ],
    quarterly: [
      { period:"24Q1", revenue:36_455, operatingIncome:13_816, netIncome:12_369, operatingCF:19_247, capex:-8_337  },
      { period:"24Q2", revenue:39_071, operatingIncome:14_866, netIncome:13_465, operatingCF:19_381, capex:-8_173  },
      { period:"24Q3", revenue:40_589, operatingIncome:17_344, netIncome:15_688, operatingCF:20_416, capex:-9_230  },
      { period:"24Q4", revenue:48_385, operatingIncome:23_357, netIncome:20_838, operatingCF:26_400, capex:-14_000 },
    ],
  },
};

function buildFromUSMock(symbol: string, name: string): FinancialData | null {
  const entry = US_MOCK[symbol.toUpperCase()];
  if (!entry) return null;

  const toReport = (r: USAnnual): FinancialReport => {
    const opM = r.revenue ? Math.round((r.operatingIncome / r.revenue) * 1000) / 10 : 0;
    const niM = r.revenue ? Math.round((r.netIncome / r.revenue) * 1000) / 10 : 0;
    const dr  = r.totalEquity ? Math.round((r.totalLiabilities / r.totalEquity) * 100) : 0;
    return {
      period: r.period, revenue: r.revenue, grossProfit: r.grossProfit,
      operatingIncome: r.operatingIncome, operatingMargin: opM,
      netIncome: r.netIncome, netMargin: niM, ebitda: r.ebitda,
      totalAssets: r.totalAssets, totalLiabilities: r.totalLiabilities, totalEquity: r.totalEquity,
      debtRatio: dr, operatingCashFlow: r.operatingCF, capex: r.capex,
      freeCashFlow: r.operatingCF + r.capex,
    };
  };

  const annual: FinancialReport[] = entry.annual.map(toReport);
  const quarterly: FinancialReport[] = entry.quarterly.map(r => ({
    period: r.period, revenue: r.revenue,
    operatingIncome: r.operatingIncome,
    operatingMargin: r.revenue ? Math.round((r.operatingIncome / r.revenue) * 1000) / 10 : 0,
    netIncome: r.netIncome,
    netMargin: r.revenue ? Math.round((r.netIncome / r.revenue) * 1000) / 10 : 0,
    operatingCashFlow: r.operatingCF, capex: r.capex,
    freeCashFlow: r.operatingCF + r.capex,
  }));

  return { symbol, name: entry.name, market: "US", currency: "USD", unit: "백만달러", annual, quarterly, isMock: true };
}

// Safe generic mock for unknown US stocks (no NaN risk)
function generateUsMock(symbol: string, name: string): FinancialData {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 5_000 + (seed % 50_000);
  const gr = 1.1;
  const annual: FinancialReport[] = ["2021","2022","2023","2024"].map((y, i) => {
    const rev = Math.round(base * Math.pow(gr, i));
    const op  = Math.round(rev * 0.18);
    const ni  = Math.round(rev * 0.14);
    const ta  = Math.round(rev * 2.5);
    const tl  = Math.round(ta * 0.4);
    const te  = ta - tl;
    const cf  = Math.round(rev * 0.22);
    const cx  = -Math.round(rev * 0.06);
    return {
      period: y, revenue: rev, grossProfit: Math.round(rev * 0.55),
      operatingIncome: op, operatingMargin: 18,
      netIncome: ni, netMargin: 14, ebitda: Math.round(rev * 0.25),
      totalAssets: ta, totalLiabilities: tl, totalEquity: te,
      debtRatio: Math.round((tl / te) * 100),
      operatingCashFlow: cf, capex: cx, freeCashFlow: cf + cx,
    };
  });
  const quarterly: FinancialReport[] = ["24Q1","24Q2","24Q3","24Q4"].map(p => {
    const rev = Math.round(annual[3].revenue! / 4);
    return {
      period: p, revenue: rev,
      operatingIncome: Math.round(rev * 0.18), operatingMargin: 18,
      netIncome: Math.round(rev * 0.14), netMargin: 14,
    };
  });
  return { symbol, name, market:"US", currency:"USD", unit:"백만달러", annual, quarterly, isMock: true };
}

// ── Alpha Vantage (US stocks) ───────────────────────────────────────────────

function safe(v: string | undefined): number | undefined {
  if (!v || v === "None" || v === "-") return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function toM(v: string | undefined): number | undefined {
  const n = safe(v);
  return n !== undefined ? Math.round(n / 1_000_000) : undefined;
}

function quarter(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear().toString().slice(2);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${y}Q${q}`;
}

async function fetchAV(fn: string, symbol: string, key: string) {
  const url = `https://www.alphavantage.co/query?function=${fn}&symbol=${symbol}&apikey=${key}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  const json = await res.json() as Record<string, unknown>;
  if (json["Note"] || json["Information"]) throw new Error("AV rate-limited");
  return json;
}

type AVRow = Record<string, string>;

async function buildFromAV(symbol: string, name: string): Promise<FinancialData> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("No AV key");

  const [inc, bal, cf] = await Promise.all([
    fetchAV("INCOME_STATEMENT", symbol, key),
    fetchAV("BALANCE_SHEET",    symbol, key),
    fetchAV("CASH_FLOW",        symbol, key),
  ]);

  const iAnnual = (inc["annualReports"]  as AVRow[]) ?? [];
  const bAnnual = (bal["annualReports"]  as AVRow[]) ?? [];
  const cAnnual = (cf["annualReports"]   as AVRow[]) ?? [];
  const iQtr    = (inc["quarterlyReports"] as AVRow[]).slice(0, 4).reverse();
  const bQtr    = (bal["quarterlyReports"] as AVRow[]).slice(0, 4).reverse();
  const cQtr    = (cf["quarterlyReports"]  as AVRow[]).slice(0, 4).reverse();

  // Map by date for easy joining
  const byDate = <T extends AVRow>(rows: T[]) =>
    Object.fromEntries(rows.map(r => [r["fiscalDateEnding"], r]));

  const bMap = byDate(bAnnual);
  const cMap = byDate(cAnnual);

  const annual: FinancialReport[] = iAnnual.slice(0, 4).reverse().map(r => {
    const date = r["fiscalDateEnding"];
    const b    = bMap[date] ?? {};
    const c    = cMap[date] ?? {};
    const rev  = toM(r["totalRevenue"]);
    const op   = toM(r["operatingIncome"]);
    const ni   = toM(r["netIncome"]);
    const opCF = toM(c["operatingCashflow"]);
    const cx   = toM(c["capitalExpenditures"]);
    const tl   = toM(b["totalLiabilities"]);
    const te   = toM(b["totalShareholderEquity"]);
    return {
      period:           new Date(date).getFullYear().toString(),
      revenue:          rev,
      grossProfit:      toM(r["grossProfit"]),
      operatingIncome:  op,
      operatingMargin:  rev && op !== undefined ? Math.round((op / rev) * 1000) / 10 : undefined,
      netIncome:        ni,
      netMargin:        rev && ni !== undefined ? Math.round((ni / rev) * 1000) / 10 : undefined,
      ebitda:           toM(r["ebitda"]),
      totalAssets:      toM(b["totalAssets"]),
      totalLiabilities: tl,
      totalEquity:      te,
      debtRatio:        tl && te ? Math.round((tl / te) * 100) : undefined,
      operatingCashFlow: opCF,
      capex:            cx !== undefined ? -cx : undefined,
      freeCashFlow:     opCF !== undefined && cx !== undefined ? opCF - cx : undefined,
    };
  });

  const bQtrMap = byDate(bQtr);
  const cQtrMap = byDate(cQtr);

  const quarterly: FinancialReport[] = iQtr.map(r => {
    const date = r["fiscalDateEnding"];
    const c    = cQtrMap[date] ?? {};
    const rev  = toM(r["totalRevenue"]);
    const op   = toM(r["operatingIncome"]);
    const ni   = toM(r["netIncome"]);
    const opCF = toM(c["operatingCashflow"]);
    const cx   = toM(c["capitalExpenditures"]);
    return {
      period:           quarter(date),
      revenue:          rev,
      operatingIncome:  op,
      operatingMargin:  rev && op !== undefined ? Math.round((op / rev) * 1000) / 10 : undefined,
      netIncome:        ni,
      netMargin:        rev && ni !== undefined ? Math.round((ni / rev) * 1000) / 10 : undefined,
      operatingCashFlow: opCF,
      capex:            cx !== undefined ? -cx : undefined,
      freeCashFlow:     opCF !== undefined && cx !== undefined ? opCF - cx : undefined,
    };
  });

  return { symbol, name, market:"US", currency:"USD", unit:"백만달러", annual, quarterly, isMock: false };
}

// ── Yahoo Finance — Korean stocks ─────────────────────────────────────────────
// Values in raw KRW → convert to 억원 (÷ 100,000,000)

function toUk(raw: number | undefined): number | undefined {
  return raw !== undefined ? Math.round(raw / 100_000_000) : undefined;
}

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getFullYear()).slice(2)}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
}

async function buildFromYF(symbol: string, name: string): Promise<FinancialData> {
  // Resolve .KS / .KQ suffix (auto-detects KOSPI vs KOSDAQ)
  const yfSym = symbol.includes(".") ? symbol : await resolveKrYahooSymbol(symbol);
  const fin   = await fetchYFFinancials(yfSym);
  if (!fin) throw new Error("YF no data");

  const incA = fin.incomeStatementHistory?.incomeStatementHistory    ?? [];
  const balA = fin.balanceSheetHistory?.balanceSheetStatements        ?? [];
  const cfA  = fin.cashflowStatementHistory?.cashflowStatements       ?? [];
  const incQ = fin.incomeStatementHistoryQuarterly?.incomeStatementHistory  ?? [];
  const cfQ  = fin.cashflowStatementHistoryQuarterly?.cashflowStatements     ?? [];

  if (!incA.length) throw new Error("YF empty income");

  // Join by date
  const byDate = <T extends { endDate: { fmt: string } }>(rows: T[]) =>
    Object.fromEntries(rows.map(r => [r.endDate.fmt, r]));

  const balMap  = byDate(balA);
  const cfMap   = byDate(cfA);
  const cfQMap  = byDate(cfQ);

  const buildAnnualRow = (inc: YFIncomeRow): FinancialReport => {
    const date = inc.endDate.fmt;
    const bal  = (balMap[date]  ?? {}) as Partial<YFBalanceRow>;
    const cf   = (cfMap[date]   ?? {}) as Partial<YFCashFlowRow>;
    const rev  = toUk(inc.totalRevenue?.raw);
    const op   = toUk(inc.operatingIncome?.raw);
    const ni   = toUk(inc.netIncome?.raw);
    const opCF = toUk(cf.totalCashFromOperatingActivities?.raw);
    const cx   = toUk(cf.capitalExpenditures?.raw);
    const tl   = toUk(bal.totalLiabilities?.raw);
    const te   = toUk(bal.totalStockholderEquity?.raw);
    return {
      period:           new Date(date).getFullYear().toString(),
      revenue:          rev,
      grossProfit:      toUk(inc.grossProfit?.raw),
      operatingIncome:  op,
      operatingMargin:  rev && op !== undefined ? Math.round((op / rev) * 1000) / 10 : undefined,
      netIncome:        ni,
      netMargin:        rev && ni !== undefined ? Math.round((ni / rev) * 1000) / 10 : undefined,
      ebitda:           toUk(inc.ebitda?.raw),
      totalAssets:      toUk(bal.totalAssets?.raw),
      totalLiabilities: tl,
      totalEquity:      te,
      debtRatio:        tl && te ? Math.round((tl / te) * 100) : undefined,
      operatingCashFlow: opCF,
      capex:            cx !== undefined ? -Math.abs(cx) : undefined,
      freeCashFlow:     opCF !== undefined && cx !== undefined ? opCF - Math.abs(cx) : undefined,
    };
  };

  const annual: FinancialReport[] = incA
    .slice(0, 4)
    .reverse()
    .map(buildAnnualRow);

  const quarterly: FinancialReport[] = incQ
    .slice(0, 4)
    .reverse()
    .map((inc): FinancialReport => {
      const date = inc.endDate.fmt;
      const cf   = (cfQMap[date] ?? {}) as Partial<YFCashFlowRow>;
      const rev  = toUk(inc.totalRevenue?.raw);
      const op   = toUk(inc.operatingIncome?.raw);
      const ni   = toUk(inc.netIncome?.raw);
      const opCF = toUk(cf.totalCashFromOperatingActivities?.raw);
      const cx   = toUk(cf.capitalExpenditures?.raw);
      return {
        period:           quarterLabel(date),
        revenue:          rev,
        operatingIncome:  op,
        operatingMargin:  rev && op !== undefined ? Math.round((op / rev) * 1000) / 10 : undefined,
        netIncome:        ni,
        netMargin:        rev && ni !== undefined ? Math.round((ni / rev) * 1000) / 10 : undefined,
        operatingCashFlow: opCF,
        capex:            cx !== undefined ? -Math.abs(cx) : undefined,
        freeCashFlow:     opCF !== undefined && cx !== undefined ? opCF - Math.abs(cx) : undefined,
      };
    });

  return {
    symbol, name, market: "KR", currency: "KRW", unit: "억원",
    annual, quarterly, isMock: false,
  };
}

// ── DART — Korean stocks ──────────────────────────────────────────────────────

// Korean company name map (supplement when DART doesn't return corp_name in financial response)
const KR_NAME_MAP: Record<string, string> = {
  "005930": "삼성전자", "000660": "SK하이닉스", "035420": "NAVER",
  "035720": "카카오",   "005380": "현대차",     "000270": "기아",
  "373220": "LG에너지솔루션", "006400": "삼성SDI",   "068270": "셀트리온",
  "207940": "삼성바이오로직스", "326030": "SK바이오팜","042700": "한미반도체",
  "000990": "DB하이텍", "096770": "SK이노베이션","247540": "에코프로비엠",
  "041510": "에스엠",   "035900": "JYP엔터",    "105560": "KB금융",
  "055550": "신한지주", "086790": "하나금융지주","051910": "LG화학",
  "011170": "롯데케미칼","009830": "한화솔루션", "000720": "현대건설",
  "028260": "삼성물산", "005490": "POSCO홀딩스","004020": "현대제철",
  "259960": "크래프톤", "036570": "NCsoft",     "263750": "펄어비스",
  "012330": "현대모비스",
};

function margin(op?: number, rev?: number) {
  return op !== undefined && rev ? Math.round((op / rev) * 1000) / 10 : undefined;
}

async function buildFromDart(symbol: string, displayName: string): Promise<FinancialData> {
  const sc = symbol.replace(/\.(KS|KQ)$/, "");
  const fin = await fetchDartKrFinancials(sc);

  const annual: FinancialReport[] = fin.annual.map(r => ({
    period:            r.period,
    revenue:           r.revenue,
    grossProfit:       r.grossProfit,
    operatingIncome:   r.operatingIncome,
    operatingMargin:   margin(r.operatingIncome, r.revenue),
    netIncome:         r.netIncome,
    netMargin:         margin(r.netIncome, r.revenue),
    totalAssets:       r.totalAssets,
    totalLiabilities:  r.totalLiabilities,
    totalEquity:       r.totalEquity,
    debtRatio:         r.totalLiabilities && r.totalEquity
                         ? Math.round((r.totalLiabilities / r.totalEquity) * 100)
                         : undefined,
    operatingCashFlow: r.operatingCF,
    capex:             r.capex,
    freeCashFlow:      r.operatingCF !== undefined && r.capex !== undefined
                         ? r.operatingCF + r.capex
                         : undefined,
  }));

  const quarterly: FinancialReport[] = fin.quarterly.map(r => ({
    period:          r.period,
    revenue:         r.revenue,
    operatingIncome: r.operatingIncome,
    operatingMargin: margin(r.operatingIncome, r.revenue),
    netIncome:       r.netIncome,
    netMargin:       margin(r.netIncome, r.revenue),
    operatingCashFlow: r.operatingCF,
    capex:           r.capex,
    freeCashFlow:    r.operatingCF !== undefined && r.capex !== undefined
                       ? r.operatingCF + r.capex
                       : undefined,
  }));

  const name = KR_NAME_MAP[sc] ?? displayName;
  return { symbol: sc, name, market: "KR", currency: "KRW", unit: "억원", annual, quarterly, isMock: false };
}

// ── Yahoo Finance — US stocks ─────────────────────────────────────────────────
// Raw USD values → convert to millions (÷ 1,000,000)

function toMil(raw: number | undefined): number | undefined {
  return raw !== undefined ? Math.round(raw / 1_000_000) : undefined;
}

async function buildFromYFUS(symbol: string, name: string): Promise<FinancialData> {
  const fin = await fetchYFFinancials(symbol);
  if (!fin) throw new Error("YF no data");

  const incA = fin.incomeStatementHistory?.incomeStatementHistory    ?? [];
  const balA = fin.balanceSheetHistory?.balanceSheetStatements        ?? [];
  const cfA  = fin.cashflowStatementHistory?.cashflowStatements       ?? [];
  const incQ = fin.incomeStatementHistoryQuarterly?.incomeStatementHistory  ?? [];
  const cfQ  = fin.cashflowStatementHistoryQuarterly?.cashflowStatements     ?? [];

  if (!incA.length) throw new Error("YF empty income");

  const byDate = <T extends { endDate: { fmt: string } }>(rows: T[]) =>
    Object.fromEntries(rows.map(r => [r.endDate.fmt, r]));

  const balMap = byDate(balA);
  const cfMap  = byDate(cfA);
  const cfQMap = byDate(cfQ);

  const annual: FinancialReport[] = incA.slice(0, 4).reverse().map((inc): FinancialReport => {
    const date = inc.endDate.fmt;
    const bal  = (balMap[date] ?? {}) as Partial<YFBalanceRow>;
    const cf   = (cfMap[date]  ?? {}) as Partial<YFCashFlowRow>;
    const rev  = toMil(inc.totalRevenue?.raw);
    const op   = toMil(inc.operatingIncome?.raw);
    const ni   = toMil(inc.netIncome?.raw);
    const opCF = toMil(cf.totalCashFromOperatingActivities?.raw);
    const cx   = toMil(cf.capitalExpenditures?.raw);
    const tl   = toMil(bal.totalLiabilities?.raw);
    const te   = toMil(bal.totalStockholderEquity?.raw);
    return {
      period:            new Date(date).getFullYear().toString(),
      revenue:           rev,
      grossProfit:       toMil(inc.grossProfit?.raw),
      operatingIncome:   op,
      operatingMargin:   rev && op !== undefined ? Math.round((op / rev) * 1000) / 10 : undefined,
      netIncome:         ni,
      netMargin:         rev && ni !== undefined ? Math.round((ni / rev) * 1000) / 10 : undefined,
      ebitda:            toMil(inc.ebitda?.raw),
      totalAssets:       toMil(bal.totalAssets?.raw),
      totalLiabilities:  tl,
      totalEquity:       te,
      debtRatio:         tl && te ? Math.round((tl / te) * 100) : undefined,
      operatingCashFlow: opCF,
      capex:             cx !== undefined ? -Math.abs(cx) : undefined,
      freeCashFlow:      opCF !== undefined && cx !== undefined ? opCF - Math.abs(cx) : undefined,
    };
  });

  const quarterly: FinancialReport[] = incQ.slice(0, 4).reverse().map((inc): FinancialReport => {
    const date = inc.endDate.fmt;
    const cf   = (cfQMap[date] ?? {}) as Partial<YFCashFlowRow>;
    const rev  = toMil(inc.totalRevenue?.raw);
    const op   = toMil(inc.operatingIncome?.raw);
    const ni   = toMil(inc.netIncome?.raw);
    const opCF = toMil(cf.totalCashFromOperatingActivities?.raw);
    const cx   = toMil(cf.capitalExpenditures?.raw);
    return {
      period:            quarterLabel(date),
      revenue:           rev,
      operatingIncome:   op,
      operatingMargin:   rev && op !== undefined ? Math.round((op / rev) * 1000) / 10 : undefined,
      netIncome:         ni,
      netMargin:         rev && ni !== undefined ? Math.round((ni / rev) * 1000) / 10 : undefined,
      operatingCashFlow: opCF,
      capex:             cx !== undefined ? -Math.abs(cx) : undefined,
      freeCashFlow:      opCF !== undefined && cx !== undefined ? opCF - Math.abs(cx) : undefined,
    };
  });

  return { symbol, name, market: "US", currency: "USD", unit: "백만달러", annual, quarterly, isMock: false };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "AAPL";
  const market = (req.nextUrl.searchParams.get("market") ?? "US") as "KR" | "US";
  const name   = req.nextUrl.searchParams.get("name") ?? symbol;

  const key = `${symbol}|${market}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return Response.json(hit.data, { headers: { "X-Cache": "HIT" } });
  }

  let data: FinancialData;

  if (market === "KR") {
    // 1. DART OpenAPI  — real government-filed data (primary)
    // 2. KR_MOCK preset — complete but static (fallback for known stocks)
    // 3. Generated mock — last resort for unknown stocks
    try {
      data = await buildFromDart(symbol, name);
      console.info("[financials] DART OK:", symbol);
    } catch (dartErr) {
      console.warn("[financials] DART failed:", (dartErr as Error).message, "→ preset/mock");
      data = buildFromKrMock(symbol) ?? generateKrMock(symbol, name);
    }
  } else {
    // 1. Try Alpha Vantage
    // 2. Try Yahoo Finance
    // 3. Fall back to preset mock → generated mock
    try {
      data = await buildFromAV(symbol, name);
      console.info("[financials] AV OK:", symbol);
    } catch (avErr) {
      console.warn("[financials] AV failed:", (avErr as Error).message, "→ trying YF");
      try {
        data = await buildFromYFUS(symbol, name);
        console.info("[financials] YF US OK:", symbol);
      } catch (yfErr) {
        console.warn("[financials] YF US failed:", (yfErr as Error).message, "→ preset/mock");
        data = buildFromUSMock(symbol, name) ?? generateUsMock(symbol, name);
      }
    }
  }

  cache.set(key, { data, ts: Date.now() });
  return Response.json(data);
}
