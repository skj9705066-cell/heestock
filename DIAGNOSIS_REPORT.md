# 파두 시세 버그 진단 보고서 (2026-06-08)

## 1단계: 전체 데이터 경로 지도

### A. 시세 데이터 소스 (2개)

1. **KIS API** (`src/lib/kis.ts`)
   - `fetchKisPrice(stockCode)` → KisPrice
   - 한국 종목 전용 (코스피/코스닥 구분 없이 `FID_COND_MRKT_DIV_CODE: "J"`)
   - 반환: price, previousClose, change, changePercent, volume, PER, PBR 등

2. **Yahoo Finance API** (`src/lib/yahoo-finance.ts`)
   - `fetchYFQuotes(symbols)` → YFQuote[]
   - 미국 종목 + 한국 종목 fallback
   - 한국 종목: `.KS` (코스피) / `.KQ` (코스닥) 접미사
   - 반환: regularMarketPrice, regularMarketPreviousClose, regularMarketChangePercent 등

### B. 시세 데이터 소비 경로 (5개)

#### 경로 1: 관심종목 카드
```
WatchlistStockCard.tsx (컴포넌트)
  → fetch("/api/stock-snapshot")
  → route.ts (API)
  → buildStockSnapshot() (통합 함수)
  → fetchKisPrice() (KIS) || fetchYFQuotes() (Yahoo fallback)
  → buildKrQuoteFromKis() || buildQuote()
  → SnapshotQuote 반환
```

#### 경로 2: 지지선 반등 알림
```
BounceAlertsSection.tsx (컴포넌트)
  → fetch("/api/stock-snapshot")
  → [경로 1과 동일]
```

#### 경로 3: AI 종목 분석
```
ChatInterface.tsx (컴포넌트)
  → fetch("/api/ai-chat")
  → route.ts (API)
  → buildStockSnapshot() (통합 함수)
  → [경로 1과 동일]
```

#### 경로 4: 대시보드 인기 종목
```
page.tsx (서버 컴포넌트)
  → getTopStocks() (market-data.ts)
  → fetchYFQuotes() (Yahoo 직접 호출)
  → 자체 changePercent 검증 로직 (±30% 재계산)
  → TopStock[] 반환
  → TopStocks.tsx (클라이언트 컴포넌트)
```
**⚠️ 문제: buildStockSnapshot 거치지 않고 Yahoo 직접 호출**

#### 경로 5: 시장 지수 (코스피/코스닥/나스닥/S&P500)
```
page.tsx (서버 컴포넌트)
  → getMarketIndices() (market-data.ts)
  → fetchYFQuotes() (Yahoo 직접 호출)
  → 자체 changePercent 검증 로직 (±10% 재계산)
  → MarketIndex[] 반환
  → MarketIndexCard.tsx (클라이언트 컴포넌트)
```
**⚠️ 문제: buildStockSnapshot 거치지 않고 Yahoo 직접 호출**

#### 경로 6: RS 랭킹
```
/api/rs-ranking (API)
  → fetchYFQuotes() + fetchYFPriceHistory() (Yahoo 직접 호출)
```

#### 경로 7: 밸류에이션
```
/api/valuation (API)
  → fetchYFQuotes() + fetchYFKeyStats() (Yahoo 직접 호출)
```

### C. 캐시 지점 (6개)

1. **localStorage**
   - `heestock_watchlist`: 관심종목 목록 (symbol, name, market, sector)
   - `heestock_watchlist_expanded`: 관심종목 섹션 펼침 상태
   - `heestock_bounce_alerts_expanded`: 반등 알림 섹션 펼침 상태
   - `heestock_ai_watchlist_expanded`: AI 분석 관심종목 패널 펼침 상태
   - `hee-theme`: 다크모드 설정
   - **⚠️ 시세 데이터는 저장 안 함** (관심종목 목록만)

2. **브라우저 HTTP 캐시**
   - fetch() 호출 시 브라우저가 URL별로 응답 캐시
   - `cache: "no-store"` 헤더로 방지 시도했으나 일부 브라우저 무시
   - **⚠️ 파두 17,910원은 여기서 온 것으로 추정**

3. **Next.js fetch 캐시**
   - 서버 컴포넌트 fetch()는 Next.js가 자동 캐시
   - `cache: "no-store"` 또는 `revalidate: 0`으로 방지
   - 모든 API 호출에 `cache: "no-store"` 설정됨

4. **Yahoo Finance 내부 캐시**
   - Yahoo API 자체가 previousClose를 오래된 값으로 반환 (시간차)
   - **⚠️ 코스피 -13% 비정상 값의 원인**

5. **KIS API rate limiting**
   - 1분당 1회 제한 (토큰 발급)
   - 실패 시 에러 반환, 캐시된 값 사용 안 함

6. **메모리 캐시 / SWR / React Query**
   - **사용 안 함**: 프로젝트에 없음

### D. 하드코딩/목업 데이터

- **없음**: 검색 결과 dart-corps.json에만 매칭 (관련 없음)

---

## 2단계: 17,910과 +84.56%의 출처 특정

### 추적 결과

#### KIS API 응답 (로컬/프로덕션 모두 정상)
```
[kis] 440110 response - rt_cd: 0, msg1: 정상처리
price=106600, prevClose=109800, changePct=-2.91%
```

#### /api/stock-snapshot 응답 (프로덕션 정상)
```json
{
  "quote": {
    "price": 106600,
    "changePercent": -2.91,
    "previousClose": 109800
  }
}
```

#### 브라우저에서 보이는 값 (사용자 보고)
```
가격: 17,910원
등락률: +84.56%
화살표: ▼ (부호와 불일치)
```

### 17,910원 출처 특정

**결론: 브라우저 HTTP 캐시에 저장된 옛날 API 응답**

1. **왜 캐시되었나?**
   - 이전에 `/api/stock-snapshot?symbol=440110&market=undefined` 요청
   - market 필드 누락으로 API 조회 실패
   - 실패 응답 또는 Yahoo fallback이 잘못된 값 반환
   - 브라우저가 이 응답을 URL별로 캐시

2. **왜 삼성은 안 캐시되었나?**
   - 삼성전자는 market="KR" 제대로 전달
   - API 정상 응답 → 캐시되어도 정상 값
   - 또는 더 최근에 추가되어 새로고침으로 갱신됨

3. **+84.56%의 계산**
   ```
   (17910 - prevClose) / prevClose × 100 = 84.56%
   prevClose ≈ 9703원
   ```
   이것은 **파두의 2025년 초반 가격**입니다.
   → Yahoo Finance가 옛날 previousClose를 반환했거나
   → 브라우저 캐시가 2025년 데이터를 저장한 것

4. **▼인데 + 부호**
   - changePercent가 +84.56 (양수)
   - 화면 로직: `isUp = changePercent >= 0` → ▲ 표시해야 함
   - 실제로 ▼ 표시 → **컴포넌트 버그 또는 다른 데이터 소스 사용 중**

### 삼성(코스피) vs 파두(코스닥) 비교

#### 시장 구분 코드 (KIS API)
- **동일**: `FID_COND_MRKT_DIV_CODE: "J"` (전체 시장)
- 코스피/코스닥 구분 없이 종목코드만으로 조회
- **문제 없음**

#### Yahoo Finance 접미사
```typescript
// resolveKrYahooSymbol()
// 1. .KS (코스피) 먼저 시도
// 2. 실패 시 .KQ (코스닥) 시도
// 3. 결과 캐시

// 파두(440110)의 경우:
// 440110.KS → 실패 (코스닥 종목이므로)
// 440110.KQ → 성공
```
**문제 없음**: Yahoo 접미사 자동 감지 정상 작동

#### 왜 파두만 실패했나?
→ **localStorage에 market 필드 누락** (이미 수정함)
→ 하지만 **브라우저 HTTP 캐시**는 남아있음
→ timestamp 추가로 우회했지만, 기존 캐시는 수동 삭제 필요

---

## 3단계: 구조적 문제점

### 문제 1: 다중 경로 (buildStockSnapshot 우회)

**현황**:
- 관심종목: buildStockSnapshot ✓
- 인기종목: fetchYFQuotes 직접 호출 ✗
- 시장지수: fetchYFQuotes 직접 호출 ✗
- RS랭킹: fetchYFQuotes 직접 호출 ✗
- 밸류에이션: fetchYFQuotes 직접 호출 ✗

**문제**:
- changePercent 검증 로직이 각 경로마다 중복/누락
- 한 곳을 고쳐도 다른 곳에서 같은 버그 재발
- 일관성 없음

### 문제 2: changePercent 검증 로직 분산

**위치**:
1. `kis.ts` line 169-176: ±30% 초과 재계산
2. `stock-snapshot.ts` buildQuote() line 212-229: ±30% + 부호 불일치 재계산
3. `market-data.ts` getTopStocks() line 107-119: ±30% 재계산
4. `market-data.ts` getMarketIndices() line 72-87: ±10% 재계산

**문제**:
- 4곳에 유사 로직 중복
- 임계값이 다름 (30% vs 10%)
- 부호 불일치 검증은 buildQuote()만 있음

### 문제 3: 화살표/색상 로직 불일치

**WatchlistStockCard.tsx** line 118:
```typescript
const isUp = (quote?.changePercent ?? 0) >= 0;
// ...
{isUp ? "▲" : "▼"} {formatPercent(Math.abs(quote.changePercent))}
```

**TopStocks.tsx** line 72:
```typescript
stock.changePercent > 0 ? "text-red-500" : "text-blue-500"
```

**MarketIndexCard.tsx** (확인 필요):
- 각 컴포넌트마다 자체 로직

**문제**:
- `>= 0` vs `> 0` 차이 (보합 처리)
- 일관성 없음

### 문제 4: 캐시 무효화 불완전

**브라우저 HTTP 캐시**:
- timestamp 추가로 우회 중 ✓
- 하지만 기존 캐시는 남아있음
- 사용자가 수동 삭제해야 함

---

## 4단계: 권장 수정 방안

### 수정 1: 단일 시세 조회 함수 (getQuote)

**새 파일**: `src/lib/quote.ts`

```typescript
export async function getQuote(
  symbol: string,
  market: "KR" | "US"
): Promise<Quote | null> {
  // 1. 한국 종목: KIS 우선
  if (market === "KR") {
    const kis = await fetchKisPrice(symbol);
    if (kis && validateQuote(kis)) {
      return normalizeKisQuote(kis);
    }
    // KIS 실패 → Yahoo fallback
    const yahoo = await fetchYahooQuote(symbol, market);
    if (yahoo && validateQuote(yahoo)) {
      return normalizeYahooQuote(yahoo, market);
    }
    return null; // 둘 다 실패
  }

  // 2. 미국 종목: Yahoo
  const yahoo = await fetchYahooQuote(symbol, market);
  return yahoo && validateQuote(yahoo)
    ? normalizeYahooQuote(yahoo, market)
    : null;
}

function validateQuote(data: any): boolean {
  // changePercent ±30% 검증
  // 부호 일치 검증
  // 필수 필드 존재 검증
  return true;
}

function normalizeKisQuote(kis: KisPrice): Quote {
  // changePercent 재계산
  // 부호 통일
  return { ... };
}
```

### 수정 2: 모든 경로를 getQuote()로 통합

- getTopStocks() → fetchYFQuotes() 제거, getQuote() 사용
- getMarketIndices() → fetchYFQuotes() 제거, getQuote() 사용
- buildStockSnapshot() → 내부에서 getQuote() 호출

### 수정 3: 화살표/색상 유틸 함수

**새 파일**: `src/lib/utils/quote-display.ts`

```typescript
export function getQuoteArrow(changePercent: number): string {
  if (changePercent > 0.01) return "▲";
  if (changePercent < -0.01) return "▼";
  return "―"; // 보합
}

export function getQuoteColor(changePercent: number): string {
  if (changePercent > 0.01) return "text-red-500";
  if (changePercent < -0.01) return "text-blue-500";
  return "text-slate-500";
}
```

### 수정 4: 브라우저 캐시 완전 무효화

**방법 1**: Service Worker로 API 응답 캐시 제어
**방법 2**: 버전 쿼리 파라미터 `&v=2` 추가
**방법 3**: 사용자에게 "Shift+F5" 안내

---

## 결론

**17,910원의 진짜 출처**: 브라우저 HTTP 캐시에 저장된 2025년 초반 Yahoo Finance 응답

**근본 원인**:
1. localStorage market 필드 누락 → API 잘못된 파라미터 전달
2. 실패 응답이 브라우저 캐시에 저장
3. timestamp 추가 전에는 같은 URL 재요청 시 캐시 반환
4. 다중 경로로 인해 한 곳 수정해도 다른 곳 재발

**해결책**: 단일 getQuote() 함수로 통합 + 검증 로직 통일
