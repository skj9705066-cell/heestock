# 윤희스탁 (YunheeStock)

AI 기반 한국·미국 주식 종합 분석 플랫폼. Claude AI를 활용한 실시간 종목 분석 서비스.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **메인 대시보드** | 코스피/코스닥/나스닥/S&P500 실시간 지수, AI 시황 브리핑, 섹터 히트맵 |
| **AI 종목 분석** | Claude AI 기반 무제한 질문, 수급/기술적/펀더멘탈 분석, PDF 저장 |
| **시장 신호등** | 단기/장기 추세 신호, ADR 차트, 52주 신고가, 돌파 리스트 |
| **RS 순위** | 상대강도 랭킹 (1M/3M/6M/12M), MTT 템플릿 충족 여부 |
| **밸류에이션** | PER/PBR/ROE, 향후 3개년 추정 PER, 동종업계 비교 |

## 기술 스택

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS** (다크/라이트 모드)
- **Anthropic Claude API** (claude-sonnet-4-6)
- **Supabase** (DB + Auth)
- **Recharts** (차트 시각화)

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일에 API 키를 입력하세요:

```env
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 2. 설치 및 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인하세요.

### 3. 빌드

```bash
npm run build
npm start
```

## Vercel 배포

### 방법 1: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### 방법 2: GitHub 연동

1. 이 프로젝트를 GitHub에 push
2. [vercel.com](https://vercel.com) 에서 "Import Project"
3. 환경 변수 설정:
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy 클릭

## 폴더 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── page.tsx            # 메인 대시보드
│   ├── ai-analysis/        # AI 종목 분석
│   ├── market-signals/     # 시장 신호등
│   ├── rs-ranking/         # RS 순위
│   ├── valuation/          # 밸류에이션
│   └── api/                # API 라우트
├── components/
│   ├── layout/             # Sidebar, Header
│   ├── dashboard/          # 대시보드 컴포넌트
│   ├── ai-analysis/        # AI 분석 컴포넌트
│   ├── market-signals/     # 시장 신호 컴포넌트
│   ├── rs-ranking/         # RS 순위 컴포넌트
│   ├── valuation/          # 밸류에이션 컴포넌트
│   └── ui/                 # 공통 UI 컴포넌트
├── lib/                    # 유틸리티, API 클라이언트
├── hooks/                  # 커스텀 훅
├── types/                  # TypeScript 타입 정의
└── context/                # React Context
```

## 면책사항

본 서비스의 AI 분석 및 데이터는 투자 참고용이며 투자 권유가 아닙니다.
투자 결정은 본인 판단 하에 이루어져야 합니다.
