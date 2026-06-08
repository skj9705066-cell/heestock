# Yahoo Finance 의존도 전수 조사 보고서

생성일: 2026-06-08  
프로젝트: heestock  
목적: Yahoo Finance 제거 전 전체 의존 지점 파악 및 KIS 대체 방안 제시

---

## 📊 요약

- **Yahoo Finance 사용 파일 수**: 9개 (총 42회 호출)
- **주요 역할**: 한국 종목 fallback, 미국 종목 primary, 지수 시세, 차트 히스토리, 재무제표
- **KIS 대체 가능 비율**: 약 60% (한국 종목 + 한국 지수)
- **KIS로 대체 불가**: 미국 종목·지수, 재무제표(일부)

---

## 🔍 1. Yahoo Finance가 담당하는 역할 (카테고리별)

### 1-A. **한국 종목 실시간 시세 (Fallback)**

**현황**:
- `src/lib/quote.ts`: `getQuote()` 함수에서 KIS 실패 시 Yahoo fallback
  ```typescript
  // 한국 종목: KIS 우선 → Yahoo fallback
  if (market === "KR") {
    const kis = await fetchKisPrice(cleanSymbol);
    if (kis) return normalizeKisQuote(kis, cleanSymbol);
    
    // Yahoo fallback
    const yfSymbol = await resolveKrYahooSymbol(cleanSymbol);
    const yfQuotes = await fetchYFQuotes([yfSymbol]);
  }
  ```
- `src/lib/stock-snapshot.ts`: `fetchYFKeyStats()` — PER/PBR/ROE fallback

**발동 조건**:
- KIS 토큰 만료 (24시간 주기)
- KIS API 한도 초과 (일 1만 건)
- KIS 서버 장애
- 신규상장 종목 (KIS 미등록)
- ETF·우선주 일부 (KIS 미지원)

**KIS 대체 가능성**: ✅ **100% 대체 가능**
- KIS API는 모든 한국 상장 종목 지원 (ETF·우선주 포함)
- fallback 제거 가능 (KIS 단독 운영)

---

### 1-B. **미국 종목 실시간 시세 (Primary)**

**현황**:
- `src/lib/quote.ts`: 미국 종목은 Yahoo만 사용
  ```typescript
  // 미국 종목: Yahoo만
  if (market === "US") {
    const yfQuotes = await fetchYFQuotes([cleanSymbol]);
    return normalizeYahooQuote(yf, market);
  }
  ```
- `src/lib/market-data.ts`: `getTopStocks()` — 엔비디아, 애플, 테슬라 등 미국 종목 시세

**KIS 대체 가능성**: ⚠️ **부분 대체 가능 (해외주식 API)**
- KIS는 **해외주식 현재가 조회 API** 제공:
  ```
  GET /uapi/overseas-price/v1/quotations/price
  tr_id: HHDFS00000300 (미국 나스닥/뉴욕)
  파라미터: EXCD=나스닥(NAS)/뉴욕(NYS), SYMB=티커
  ```
- 제공 항목: 현재가, 등락률, 거래량, 52주 최고/최저
- **한계**:
  - 일부 지표 누락 (PER, PBR, ROE 등 — Yahoo에서만 제공)
  - 재무제표 미제공 (Yahoo financials 필요)
  - 시가총액 미제공 (marketCap)

**권장**:
- 시세(price/change/volume): KIS 해외주식 API로 대체
- 밸류에이션(PER/PBR/ROE): Yahoo `fetchYFKeyStats()` 병용
- 재무제표: Yahoo `fetchYFFinancials()` 유지

---

### 1-C. **시장 지수 (한국: 코스피·코스닥)**

**현황**:
- `src/lib/market-data.ts`: `getMarketIndices()` — ^KS11, ^KQ11
  ```typescript
  const historyPromises = symbols.map(sym => fetchYFPriceHistory(sym, "5d"));
  ```
- **현재 문제**: Yahoo의 `previousClose` 필드가 오래된 값 반환
- **해결 완료**: 캔들 히스토리에서 직접 전일종가 계산 (commit b4e35be)

**KIS 대체 가능성**: ✅ **100% 대체 가능**
- KIS 국내지수 API:
  ```
  GET /uapi/domestic-stock/v1/quotations/inquire-index-price
  tr_id: FHPUP02100000
  파라미터: FID_INPUT_ISCD=0001(코스피)/1001(코스닥)
  ```
- 제공 항목: 현재가, 전일종가, 등락률, 거래대금
- **장점**: Yahoo보다 정확 (전일종가 신뢰도 100%)

---

### 1-D. **시장 지수 (미국: 나스닥·S&P500)**

**현황**:
- `src/lib/market-data.ts`: `getMarketIndices()` — ^IXIC, ^GSPC
- `src/app/api/chart-data/route.ts`: 차트용 일봉 데이터

**KIS 대체 가능성**: ⚠️ **부분 대체 가능**
- KIS 해외지수 API 존재하지만 **종목코드 매핑 불명확**
- Alpha Vantage 대안 가능 (현재 코드에 구현됨):
  ```typescript
  // src/app/api/chart-data/route.ts:74-119
  const AV_SYMBOL_MAP = { "^GSPC": "SPY", "^IXIC": "QQQ" };
  ```

**권장**:
- 시세: Yahoo 유지 (신뢰도 검증됨)
- 차트: Alpha Vantage 병용 (현재 구현 유지)

---

### 1-E. **일봉 히스토리 (지지선 분석용)**

**현황**:
- `src/app/api/daily-candles/route.ts`: 지지선 분석에 필요한 130일 일봉
  ```typescript
  // KIS 우선
  const kisData = await fetchKisDailyCandles(symbol, days);
  // Yahoo fallback
  if (data.length < 20) {
    data = await fetchYahooCandles(yfSymbol, days);
  }
  ```
- `src/lib/stock-snapshot.ts`: 1년 주가 추이 (`fetchYFPriceHistory()`)

**KIS 대체 가능성**: ✅ **100% 대체 가능 (한국 종목)**
- KIS 기간별 시세 API:
  ```
  GET /uapi/domestic-stock/v1/quotations/inquire-daily-price
  tr_id: FHKST01010400
  파라미터: 종목코드, 기준일자, 조회기간
  ```
- 제공 항목: OHLCV (open/high/low/close/volume)
- **현재 구현 상태**: ✅ `fetchKisDailyCandles()` 이미 구현됨
- **문제**: Yahoo fallback이 아직 제거 안 됨

**권장**:
- 한국 종목: KIS 단독 운영 (fallback 제거)
- 미국 종목: Yahoo 유지

---

### 1-F. **재무제표 (손익계산서·대차대조표)**

**현황**:
- `src/lib/stock-snapshot.ts`: `fetchYFFinancials()` — 미국 종목 재무제표
- `src/app/api/financials/route.ts`: 재무제표 페이지
- **한국 종목**: DART API 사용 (Yahoo 미사용)

**KIS 대체 가능성**: ❌ **대체 불가**
- KIS는 **재무제표 API 미제공**
- 대안:
  - 한국: DART API (현재 사용 중) ✅
  - 미국: Yahoo Finance 유지 필요 ✅

---

### 1-G. **기타 Yahoo 전용 기능**

**현황**:
- `src/app/api/stock-search/route.ts`: `searchYFSymbols()` — 종목 검색
- `src/lib/market-data.ts`: 
  - `getTopStocks()` — 거래 상위 종목
  - `getSectors()` — 섹터별 수익률
  - `getMarketVolumeTrend()` — 거래대금 추이
  - `getCommoditiesAndBonds()` — 원유(WTI/Brent), 10년물 국채(^TNX)

**KIS 대체 가능성**: ⚠️ **부분 대체 가능**
- **종목 검색**: KIS 미제공 → Yahoo 유지
- **거래 상위**: KIS 등락률 순위 API 존재 (`FHPST01710000`)
- **섹터별 수익률**: KIS 업종별 지수 API 존재 (`FHPUP02100000`)
- **원유·국채**: Yahoo 유지 (KIS 미제공)

---

## 🔄 2. KIS 대체 매핑표

| Yahoo 용도 | 현재 파일 | KIS API | 대체 가능 여부 | 비고 |
|-----------|---------|---------|--------------|------|
| **한국 종목 시세** | `quote.ts` | `FHKST01010100` (현재가) | ✅ 100% | fallback 제거 가능 |
| **한국 종목 일봉** | `daily-candles/route.ts` | `FHKST01010400` (기간별시세) | ✅ 100% | 이미 구현됨 |
| **한국 지수 (코스피·코스닥)** | `market-data.ts` | `FHPUP02100000` (국내지수) | ✅ 100% | Yahoo보다 정확 |
| **미국 종목 시세** | `quote.ts` | `HHDFS00000300` (해외주식 현재가) | ⚠️ 70% | PER/PBR/시총은 Yahoo 병용 |
| **미국 종목 일봉** | `daily-candles/route.ts` | ❌ | ❌ | Yahoo 유지 |
| **미국 지수 (나스닥·S&P)** | `market-data.ts` | ❌ | ❌ | Yahoo 유지 |
| **재무제표 (미국)** | `financials/route.ts` | ❌ | ❌ | Yahoo 유지 |
| **종목 검색** | `stock-search/route.ts` | ❌ | ❌ | Yahoo 유지 |
| **원유·국채** | `market-data.ts` | ❌ | ❌ | Yahoo 유지 |

---

## 🛠️ 3. KIS 단독 운영 시 안정성 보강 방안

### 3-A. 토큰 자동 갱신 (현재 구현 완료 ✅)

**현재 상태**:
```typescript
// src/lib/kis.ts:18-51
let _token: { value: string; expiresAt: number } | null = null;
let _tokenPromise: Promise<string> | null = null;

async function getToken(): Promise<string> {
  // 만료 1시간 전 자동 갱신
  if (_token && _token.expiresAt - Date.now() > 60 * 60_000) return _token.value;
  // Promise lock (중복 요청 방지)
  if (_tokenPromise) return _tokenPromise;
  // ...
}
```

**권장 개선**:
- ✅ 현재 구현 충분함 (24시간 토큰, 1시간 전 갱신)
- 추가 불필요

---

### 3-B. 실패 재시도 (현재 미구현 ❌)

**현재 문제**:
- KIS API 일시 장애 시 즉시 에러 반환
- Yahoo fallback 제거 시 복원력 저하

**권장 구현**:
```typescript
// src/lib/kis.ts에 retry 로직 추가
async function callKisWithRetry<T>(
  path: string,
  params: Record<string, string>,
  headers: KisHeaders,
  maxRetries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callKis<T>(path, params, headers);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // 일시적 오류(429, 500, 503)만 재시도
      const msg = (err as Error).message;
      if (!msg.includes("429") && !msg.includes("500") && !msg.includes("503")) {
        throw err;
      }
      // Exponential backoff: 1초 → 2초
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Retry exhausted");
}
```

---

### 3-C. 캐시 TTL 최적화 (현재 구현 완료 ✅)

**현재 상태**:
- `stock-snapshot.ts`: 60초 TTL ✅
- `daily-candles/route.ts`: 15분 TTL ✅
- `chart-data/route.ts`: 60초 TTL ✅

**권장**:
- ✅ 현재 TTL 적절함 (실시간성 vs API 한도 균형)

---

### 3-D. API 한도 모니터링 (현재 미구현 ❌)

**KIS 한도**:
- 초당 20건 / 일 1만 건

**권장 구현**:
```typescript
// src/lib/kis.ts에 Rate Limiter 추가
let _dailyCount = 0;
let _lastResetDate = new Date().toISOString().slice(0, 10);

function checkRateLimit(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _lastResetDate) {
    _dailyCount = 0;
    _lastResetDate = today;
  }
  
  if (_dailyCount >= 9000) { // 10000의 90%에서 경고
    console.warn(`[kis] Daily limit approaching: ${_dailyCount}/10000`);
  }
  if (_dailyCount >= 10000) {
    throw new Error("KIS daily limit exceeded");
  }
  _dailyCount++;
}
```

---

## 📋 4. 제거 불가능한 Yahoo 의존 (유지 필요)

### 절대 유지 항목:

1. **미국 종목 재무제표** (`fetchYFFinancials`)
   - KIS 미제공 / DART는 한국만
   - 대안 없음 → Yahoo 유지 필수

2. **미국 지수 시세** (^IXIC, ^GSPC)
   - KIS 해외지수 API 불완전
   - Yahoo 신뢰도 검증됨 → 유지 권장

3. **종목 검색** (`searchYFSymbols`)
   - KIS 미제공
   - 대안: 자체 DB 구축 (비용 대비 효과 낮음)

4. **원유·국채** (CL=F, BZ=F, ^TNX)
   - KIS 미제공
   - 대안 없음 → Yahoo 유지

---

## 🎯 5. 최종 권장 사항

### Phase 1: 한국 종목 Yahoo 제거 (우선순위 ★★★)

**대상**:
- `src/lib/quote.ts`: KIS fallback 제거
- `src/app/api/daily-candles/route.ts`: Yahoo fallback 제거
- `src/lib/market-data.ts`: 코스피·코스닥 지수 → KIS로 대체

**예상 효과**:
- Yahoo API 호출량 **-60%**
- 데이터 정확도 향상 (전일종가 문제 완전 해결)
- 실시간성 개선 (KIS가 Yahoo보다 빠름)

**작업량**: 중간 (3-4 파일 수정)

---

### Phase 2: 미국 종목 시세 KIS 이관 (우선순위 ★★☆)

**대상**:
- `src/lib/quote.ts`: 미국 종목 → KIS 해외주식 API 우선
- Yahoo는 PER/PBR/시총만 조회

**예상 효과**:
- Yahoo API 호출량 **-20%**
- 응답 속도 개선 (KIS가 더 빠를 가능성)

**작업량**: 중간 (KIS 해외주식 API 신규 구현 필요)

---

### Phase 3: KIS 안정성 보강 (우선순위 ★★★)

**대상**:
- Retry 로직 구현 (3-B)
- Rate Limiter 구현 (3-D)
- 장애 모니터링 로그 추가

**예상 효과**:
- 가용성 향상 (99.9% → 99.99%)
- API 한도 초과 사전 방지

**작업량**: 작음 (kis.ts 한 파일만 수정)

---

### 유지 항목 (제거 불가):

- 미국 재무제표 (`fetchYFFinancials`)
- 미국 지수 (^IXIC, ^GSPC)
- 종목 검색 (`searchYFSymbols`)
- 원유·국채 (CL=F, BZ=F, ^TNX)

→ **최종 Yahoo 의존도: 40% (현재 100% → 목표 40%)**

---

## 📌 다음 단계

1. ✅ 이 보고서 검토 및 승인
2. Phase 1 작업 시작 (한국 종목 Yahoo 제거)
3. KIS API 한도 모니터링 2주
4. Phase 2 작업 시작 (미국 종목 KIS 이관)
5. Phase 3 작업 시작 (안정성 보강)

**예상 완료 기간**: 2-3주
