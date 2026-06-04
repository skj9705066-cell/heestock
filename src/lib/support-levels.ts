export interface OHLCVPoint {
  date:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface SupportReason {
  historicalLows:      { dates: string[]; count: number } | null;
  movingAverage:       { period: number; value: number }  | null;
  fibonacci:           { ratio: number;  label: string }  | null;
  volumeConcentration: { date: string;   volume: number } | null;
}

export interface SupportLevel {
  price:   number;
  score:   number; // 1-4
  reasons: SupportReason;
}

export interface BounceSignal {
  detected:            boolean;
  nearestSupport:      SupportLevel | null;
  distancePercent:     number;
  todayChangePercent:  number;
  volumeRatio:         number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findLocalMinima(data: OHLCVPoint[], window = 3): { price: number; date: string }[] {
  const result: { price: number; date: string }[] = [];
  for (let i = window; i < data.length - window; i++) {
    const c = data[i].low;
    let isMin = true;
    for (let j = 1; j <= window; j++) {
      if (data[i - j].low <= c || data[i + j].low <= c) { isMin = false; break; }
    }
    if (isMin) result.push({ price: c, date: data[i].date });
  }
  return result;
}

function clusterLows(lows: { price: number; date: string }[]): { price: number; dates: string[]; count: number }[] {
  const used = new Array(lows.length).fill(false);
  const clusters: { price: number; dates: string[]; count: number }[] = [];
  for (let i = 0; i < lows.length; i++) {
    if (used[i]) continue;
    let priceSum = lows[i].price;
    const dates  = [lows[i].date];
    used[i] = true;
    for (let j = i + 1; j < lows.length; j++) {
      if (!used[j] && Math.abs(lows[j].price - lows[i].price) / lows[i].price <= 0.015) {
        priceSum += lows[j].price;
        dates.push(lows[j].date);
        used[j] = true;
      }
    }
    if (dates.length >= 2) clusters.push({ price: priceSum / dates.length, dates, count: dates.length });
  }
  return clusters;
}

function calcMA(data: OHLCVPoint[], period: number): number | null {
  if (data.length < period) return null;
  return data.slice(-period).reduce((s, d) => s + d.close, 0) / period;
}

function calcFibonacci(data: OHLCVPoint[]): { price: number; ratio: number; label: string }[] {
  const high = Math.max(...data.map(d => d.high));
  const low  = Math.min(...data.map(d => d.low));
  const diff = high - low;
  if (diff === 0) return [];
  return [
    { ratio: 0.382, label: "38.2%", price: Math.round(high - diff * 0.382) },
    { ratio: 0.500, label: "50%",   price: Math.round(high - diff * 0.500) },
    { ratio: 0.618, label: "61.8%", price: Math.round(high - diff * 0.618) },
  ];
}

function findVolumeConcentration(data: OHLCVPoint[]): { price: number; date: string; volume: number }[] {
  const last20 = data.slice(-20);
  const avgVol = last20.reduce((s, d) => s + d.volume, 0) / (last20.length || 1);
  if (!avgVol) return [];
  return data
    .filter(d => d.volume >= avgVol * 1.5)
    .map(d => ({ price: Math.round((d.high + d.low) / 2), date: d.date, volume: d.volume }));
}

// ── Main exports ──────────────────────────────────────────────────────────────

export function calcSupportLevels(data: OHLCVPoint[], currentPrice: number): SupportLevel[] {
  const last120 = data.slice(-120);
  if (last120.length < 20 || !currentPrice) return [];

  // Collect candidate support prices with their source reason
  const candidates: { price: number; reason: Partial<SupportReason> }[] = [];

  // 1) Historical low clusters
  const minima   = findLocalMinima(last120);
  const clusters = clusterLows(minima);
  for (const c of clusters) {
    candidates.push({ price: Math.round(c.price), reason: { historicalLows: { dates: c.dates, count: c.count } } });
  }

  // 2) Moving averages within ±8% of current price
  for (const period of [20, 60, 120, 200] as const) {
    const ma = calcMA(data, period);
    if (ma && Math.abs(ma - currentPrice) / currentPrice <= 0.08) {
      candidates.push({ price: Math.round(ma), reason: { movingAverage: { period, value: Math.round(ma) } } });
    }
  }

  // 3) Fibonacci retracement (below current price = potential support)
  const fibs = calcFibonacci(last120);
  for (const f of fibs) {
    if (f.price < currentPrice * 1.03) {
      candidates.push({ price: f.price, reason: { fibonacci: { ratio: f.ratio, label: f.label } } });
    }
  }

  // 4) Volume concentration
  const volConc = findVolumeConcentration(last120);
  for (const v of volConc) {
    if (v.price < currentPrice * 1.03) {
      candidates.push({ price: v.price, reason: { volumeConcentration: { date: v.date, volume: v.volume } } });
    }
  }

  // Merge candidates within ±1.5% of each other
  const used   = new Array(candidates.length).fill(false);
  const merged: SupportLevel[] = [];

  for (let i = 0; i < candidates.length; i++) {
    if (used[i]) continue;
    const level: SupportLevel = {
      price:   candidates[i].price,
      score:   0,
      reasons: { historicalLows: null, movingAverage: null, fibonacci: null, volumeConcentration: null },
    };
    used[i] = true;
    const group = [i];

    for (let j = i + 1; j < candidates.length; j++) {
      if (!used[j] && Math.abs(candidates[j].price - candidates[i].price) / candidates[i].price <= 0.015) {
        group.push(j);
        used[j] = true;
      }
    }

    // Merge reasons from all group members
    for (const idx of group) {
      const r = candidates[idx].reason;
      if (r.historicalLows)      level.reasons.historicalLows = r.historicalLows;
      if (r.movingAverage) {
        if (!level.reasons.movingAverage || r.movingAverage.period < level.reasons.movingAverage.period)
          level.reasons.movingAverage = r.movingAverage;
      }
      if (r.fibonacci)           level.reasons.fibonacci           = r.fibonacci;
      if (r.volumeConcentration) level.reasons.volumeConcentration = r.volumeConcentration;
    }

    level.score = [
      level.reasons.historicalLows,
      level.reasons.movingAverage,
      level.reasons.fibonacci,
      level.reasons.volumeConcentration,
    ].filter(Boolean).length;

    if (level.score > 0) merged.push(level);
  }

  return merged
    .sort((a, b) => b.score - a.score || Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, 6);
}

export function detectBounce(
  data:          OHLCVPoint[],
  currentPrice:  number,
  supportLevels: SupportLevel[],
): BounceSignal {
  const empty: BounceSignal = { detected: false, nearestSupport: null, distancePercent: 0, todayChangePercent: 0, volumeRatio: 0 };
  if (data.length < 6 || !currentPrice) return empty;

  const strongLevels = supportLevels.filter(s => s.score >= 3);
  if (!strongLevels.length) return empty;

  const last    = data[data.length - 1];
  const prev    = data[data.length - 2];
  const prev2   = data[data.length - 3];

  const todayChange   = (currentPrice - last.close)  / (last.close  || 1);
  const last5vol      = data.slice(-5).reduce((s, d) => s + d.volume, 0) / 5;
  const volumeRatio   = last5vol > 0 ? last.volume / last5vol : 0;
  const wasFalling    = prev.close < prev2.close;

  // Find nearest strong support
  const nearestSupport = strongLevels.reduce((best, lvl) => {
    const d1 = Math.abs(lvl.price - currentPrice);
    const d2 = best ? Math.abs(best.price - currentPrice) : Infinity;
    return d1 < d2 ? lvl : best;
  }, null as SupportLevel | null);

  const distancePercent = nearestSupport
    ? Math.abs(nearestSupport.price - currentPrice) / nearestSupport.price * 100
    : 100;

  const detected = distancePercent <= 2 && wasFalling && todayChange >= 0.015 && volumeRatio >= 1.2;

  return { detected, nearestSupport, distancePercent, todayChangePercent: todayChange * 100, volumeRatio };
}

export function scoreLabel(score: number): string {
  if (score >= 3) return "🔴 강한 지지선";
  if (score === 2) return "🟡 보통 지지선";
  return "⚪ 약한 지지선";
}

export function scoreColor(score: number): string {
  if (score >= 3) return "text-red-500";
  if (score === 2) return "text-yellow-500";
  return "text-slate-400";
}
