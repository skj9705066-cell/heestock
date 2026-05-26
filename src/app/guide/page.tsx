"use client";

import {
  LayoutDashboard,
  BrainCircuit,
  TrendingUp,
  BarChart3,
  Calculator,
  FileBarChart2,
  Download,
  Moon,
  HelpCircle,
  Database,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Section header ────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, subtitle }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="flex-shrink-0 w-9 h-9 bg-blue-600/10 rounded-lg flex items-center justify-center mt-0.5">
        <Icon className="w-5 h-5 text-blue-500" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Menu guide card ───────────────────────────────────────────────────────────

function MenuCard({ icon: Icon, href, label, color, children }: {
  icon: React.ElementType;
  href: string;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{href}</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{label}</p>
        </div>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ── Data source badge ─────────────────────────────────────────────────────────

function SourceBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", color)}>
      {name}
    </span>
  );
}

// ── FAQ accordion item ────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-10 min-h-screen max-w-4xl mx-auto">

      {/* ── Hero ── */}
      <div className="card p-8 bg-gradient-to-br from-blue-600/5 to-blue-700/10 border-blue-500/20">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              희스탁 <span className="text-blue-500">HeeStock</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">AI 주식 분석 플랫폼 사용설명서</p>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          희스탁은 Claude AI와 실시간 금융 데이터를 결합해 한국·미국 주식을 분석하는 개인용 투자 리서치 도구입니다.
          대시보드부터 AI 종목 분석, 시장 신호등, 재무제표까지 — 투자 판단에 필요한 핵심 정보를 한 곳에서 제공합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="badge-neutral">한국 주식</span>
          <span className="badge-neutral">미국 주식</span>
          <span className="badge-neutral">Claude AI 분석</span>
          <span className="badge-neutral">실시간 데이터</span>
          <span className="badge-neutral">PDF 보고서</span>
        </div>
      </div>

      {/* ── 1. 메뉴별 사용법 ── */}
      <section>
        <SectionTitle
          icon={BookOpen}
          title="메뉴별 사용법"
          subtitle="사이드바의 각 메뉴에서 어떤 정보를 얻을 수 있는지 안내합니다."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <MenuCard icon={LayoutDashboard} href="/" label="대시보드" color="bg-blue-600">
            <p>시장 전체 현황을 한눈에 확인하는 메인 화면입니다.</p>
            <ul className="space-y-1 list-none pl-0">
              <li className="flex gap-2"><span className="text-blue-400">•</span><span><strong>시장 지수</strong>: KOSPI, KOSDAQ, S&P500, NASDAQ 실시간 등락</span></li>
              <li className="flex gap-2"><span className="text-blue-400">•</span><span><strong>상위 종목</strong>: 시가총액 상위 종목 가격·등락률</span></li>
              <li className="flex gap-2"><span className="text-blue-400">•</span><span><strong>섹터 히트맵</strong>: 섹터별 자금 흐름 시각화</span></li>
              <li className="flex gap-2"><span className="text-blue-400">•</span><span><strong>수급 동향</strong>: 외국인·기관·개인 매매 추이</span></li>
              <li className="flex gap-2"><span className="text-blue-400">•</span><span><strong>AI 시황 브리핑</strong>: Claude가 오늘의 시장 상황 요약</span></li>
            </ul>
          </MenuCard>

          <MenuCard icon={BrainCircuit} href="/ai-analysis" label="AI 종목 분석" color="bg-violet-600">
            <p>종목명 또는 티커를 검색해 Claude AI의 심층 분석을 받습니다.</p>
            <ul className="space-y-1 list-none pl-0">
              <li className="flex gap-2"><span className="text-violet-400">•</span><span>수급·기술적·펀더멘탈 통합 분석</span></li>
              <li className="flex gap-2"><span className="text-violet-400">•</span><span>PER, PBR, ROE 등 핵심 밸류에이션 해석</span></li>
              <li className="flex gap-2"><span className="text-violet-400">•</span><span>리스크 요인 및 투자 의견 (참고용)</span></li>
              <li className="flex gap-2"><span className="text-violet-400">•</span><span>대화 형식으로 후속 질문 가능</span></li>
            </ul>
            <p className="text-xs text-slate-400 mt-2">검색창에 &apos;삼성전자&apos;, &apos;AAPL&apos;, &apos;엔비디아&apos; 등으로 검색하세요.</p>
          </MenuCard>

          <MenuCard icon={TrendingUp} href="/market-signals" label="시장 신호등" color="bg-emerald-600">
            <p>추세 추종 투자자를 위한 시장 상태 판단 도구입니다.</p>
            <ul className="space-y-1 list-none pl-0">
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span><strong>ADR</strong>: 등락비율 (시장 강도 측정)</span></li>
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span><strong>52주 신고가 종목 수</strong>: 상승 추세 확인</span></li>
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span><strong>돌파 종목 리스트</strong>: 박스권 상방 이탈 종목</span></li>
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span>신호등 색상: 🟢 매수 / 🟡 중립 / 🔴 위험</span></li>
            </ul>
          </MenuCard>

          <MenuCard icon={BarChart3} href="/rs-ranking" label="RS 순위" color="bg-orange-500">
            <p>Minervini 방식의 상대강도(RS) 점수로 강한 종목을 찾습니다.</p>
            <ul className="space-y-1 list-none pl-0">
              <li className="flex gap-2"><span className="text-orange-400">•</span><span>1년 수익률 기반 RS 점수 (0~100)</span></li>
              <li className="flex gap-2"><span className="text-orange-400">•</span><span>RS 80 이상 = 시장 대비 강세 종목</span></li>
              <li className="flex gap-2"><span className="text-orange-400">•</span><span>한국·미국 주요 종목 비교</span></li>
              <li className="flex gap-2"><span className="text-orange-400">•</span><span>종목 클릭 → AI 분석 페이지로 이동</span></li>
            </ul>
          </MenuCard>

          <MenuCard icon={Calculator} href="/valuation" label="밸류에이션" color="bg-pink-600">
            <p>주요 종목의 가치 평가 지표를 비교 분석합니다.</p>
            <ul className="space-y-1 list-none pl-0">
              <li className="flex gap-2"><span className="text-pink-400">•</span><span><strong>PER</strong>: 주가수익비율 (낮을수록 저평가)</span></li>
              <li className="flex gap-2"><span className="text-pink-400">•</span><span><strong>PBR</strong>: 주가순자산비율</span></li>
              <li className="flex gap-2"><span className="text-pink-400">•</span><span><strong>ROE</strong>: 자기자본이익률 (수익성 지표)</span></li>
              <li className="flex gap-2"><span className="text-pink-400">•</span><span>한국: ROE + Forward PER 제공 (Yahoo Finance 기준)</span></li>
              <li className="flex gap-2"><span className="text-pink-400">•</span><span>미국: PER / PBR / ROE 전체 제공</span></li>
            </ul>
          </MenuCard>

          <MenuCard icon={FileBarChart2} href="/financials" label="재무제표" color="bg-teal-600">
            <p>기업의 연간·분기 재무 데이터를 상세 조회합니다.</p>
            <ul className="space-y-1 list-none pl-0">
              <li className="flex gap-2"><span className="text-teal-400">•</span><span>매출액, 영업이익, 당기순이익 추이</span></li>
              <li className="flex gap-2"><span className="text-teal-400">•</span><span>자산·부채·자본 구조 (부채비율)</span></li>
              <li className="flex gap-2"><span className="text-teal-400">•</span><span>영업현금흐름, CAPEX, FCF</span></li>
              <li className="flex gap-2"><span className="text-teal-400">•</span><span>연간 4개년 + 분기 4개 분기 제공</span></li>
              <li className="flex gap-2"><span className="text-teal-400">•</span><span>AI 해석 요청 및 PDF 보고서 저장 가능</span></li>
            </ul>
          </MenuCard>

        </div>
      </section>

      {/* ── 2. 데이터 출처 ── */}
      <section>
        <SectionTitle
          icon={Database}
          title="데이터 출처"
          subtitle="희스탁이 사용하는 외부 데이터 소스와 각 메뉴별 연결 현황입니다."
        />
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-slate-500 dark:text-slate-400 font-medium">데이터 소스</th>
                <th className="text-left px-5 py-3 text-slate-500 dark:text-slate-400 font-medium">제공 정보</th>
                <th className="text-left px-5 py-3 text-slate-500 dark:text-slate-400 font-medium">사용 메뉴</th>
                <th className="text-left px-5 py-3 text-slate-500 dark:text-slate-400 font-medium">제한</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr className="table-row">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                  <SourceBadge name="Yahoo Finance" color="bg-purple-500/10 text-purple-500 border-purple-500/20" />
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">실시간 지수, 종목 시세, RS 계산, 밸류에이션</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">대시보드, RS 순위, 밸류에이션</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-500 text-xs">무료 / 비공식 API</td>
              </tr>
              <tr className="table-row">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                  <SourceBadge name="DART OpenAPI" color="bg-teal-500/10 text-teal-500 border-teal-500/20" />
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">한국 기업 재무제표 (금감원 공식 공시 데이터)</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">재무제표 (한국 주식)</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-500 text-xs">무료 / 1만건/일</td>
              </tr>
              <tr className="table-row">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                  <SourceBadge name="Alpha Vantage" color="bg-orange-500/10 text-orange-500 border-orange-500/20" />
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">미국 기업 재무제표 (손익계산서·재무상태표·현금흐름)</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">재무제표 (미국 주식)</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-500 text-xs">무료 25건/일</td>
              </tr>
              <tr className="table-row">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                  <SourceBadge name="Claude AI" color="bg-violet-500/10 text-violet-500 border-violet-500/20" />
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">종목 분석, 시황 브리핑, 재무 해석</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">AI 종목 분석, 대시보드 브리핑, 재무제표 AI</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-500 text-xs">API 사용량 과금</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 px-1">
          데이터는 서버에서 최대 24시간 캐시됩니다. 실시간 데이터가 필요한 경우 페이지를 새로고침하세요.
        </p>
      </section>

      {/* ── 3. PDF 다운로드 ── */}
      <section>
        <SectionTitle
          icon={Download}
          title="PDF 보고서 다운로드"
          subtitle="재무제표 페이지에서 기업 분석 보고서를 PDF로 저장할 수 있습니다."
        />
        <div className="card p-6 space-y-4">
          <ol className="space-y-4">
            {[
              { step: "1", text: "사이드바에서 재무제표 메뉴로 이동합니다." },
              { step: "2", text: "상단 검색창에서 분석할 종목을 선택합니다. (예: 삼성전자, AAPL)" },
              { step: "3", text: "재무 데이터가 로드되면 오른쪽 상단의 AI 해석 요청 버튼을 클릭해 Claude의 재무 분석을 받습니다." },
              { step: "4", text: "PDF 다운로드 버튼을 클릭하면 재무 지표 + AI 해석이 포함된 보고서가 저장됩니다." },
            ].map(({ step, text }) => (
              <li key={step} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {step}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 pt-1">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-500 dark:text-slate-400">
            <strong>PDF 포함 항목:</strong> 연간 재무 지표 4개년 · 분기 재무 지표 · 영업이익률·순이익률 추이 · Claude AI 해석 · 데이터 출처 명시
          </div>
        </div>
      </section>

      {/* ── 4. 다크/라이트 모드 ── */}
      <section>
        <SectionTitle
          icon={Moon}
          title="다크 / 라이트 모드 전환"
        />
        <div className="card p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            사이드바 하단의 <strong className="text-slate-900 dark:text-slate-100">달 아이콘(🌙)</strong> 또는
            <strong className="text-slate-900 dark:text-slate-100"> 태양 아이콘(☀️)</strong>을 클릭해
            다크 모드와 라이트 모드를 전환할 수 있습니다.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
            선택한 테마는 브라우저에 저장되어 다음 방문 시에도 유지됩니다.
          </p>
          <div className="mt-4 flex gap-3">
            <div className="flex-1 p-3 bg-slate-900 rounded-lg border border-slate-700 text-center">
              <Moon className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xs text-slate-300 font-medium">다크 모드</p>
              <p className="text-xs text-slate-500">야간 작업에 적합</p>
            </div>
            <div className="flex-1 p-3 bg-white rounded-lg border border-slate-200 text-center">
              <Sparkles className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-slate-700 font-medium">라이트 모드</p>
              <p className="text-xs text-slate-400">주간 작업에 적합</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FAQ ── */}
      <section>
        <SectionTitle
          icon={HelpCircle}
          title="자주 묻는 질문 (FAQ)"
        />
        <div className="card px-5 divide-y divide-slate-200 dark:divide-slate-700">
          <FAQItem
            q="데이터는 얼마나 자주 업데이트되나요?"
            a={
              <div className="space-y-1">
                <p>데이터 종류에 따라 업데이트 주기가 다릅니다.</p>
                <ul className="mt-2 space-y-1">
                  <li>• <strong>시장 지수 / 종목 시세</strong>: Yahoo Finance 실시간 (60초 캐시)</li>
                  <li>• <strong>RS 순위 / 시장 신호등</strong>: API 호출 기준 실시간 (15분~1시간 캐시)</li>
                  <li>• <strong>재무제표 (한국)</strong>: DART 공시 기준, 24시간 캐시</li>
                  <li>• <strong>재무제표 (미국)</strong>: Alpha Vantage 기준, 24시간 캐시</li>
                  <li>• <strong>밸류에이션</strong>: Yahoo Finance 기준, 24시간 캐시</li>
                </ul>
              </div>
            }
          />
          <FAQItem
            q="무료 API 제한에 걸리면 어떻게 되나요?"
            a={
              <div className="space-y-2">
                <p>각 무료 API는 일일 호출 한도가 있습니다. 한도 초과 시 자동으로 대체 데이터를 사용합니다.</p>
                <ul className="space-y-1">
                  <li>• <strong>Alpha Vantage</strong> (25건/일): 미국 재무제표 조회가 25회 초과 시 Yahoo Finance 데이터로 자동 대체</li>
                  <li>• <strong>Yahoo Finance</strong>: 비공식 API로 간헐적 응답 실패 가능 — 재시도 시 정상화</li>
                  <li>• <strong>DART</strong> (1만건/일): 한국 재무제표의 경우 일반적으로 한도 초과 없음</li>
                </ul>
              </div>
            }
          />
          <FAQItem
            q="AI 분석 결과를 투자 판단에 사용해도 되나요?"
            a={
              <p>
                희스탁의 AI 분석은 <strong>투자 참고용</strong>이며 투자 권유가 아닙니다.
                Claude AI가 제공하는 분석·의견·목표가는 공개된 정보를 기반으로 한 참고 자료입니다.
                모든 투자 결정은 반드시 본인의 판단과 책임 하에 이루어져야 합니다.
              </p>
            }
          />
          <FAQItem
            q="한국 주식 재무제표는 어디서 가져오나요?"
            a={
              <p>
                한국 주식 재무제표는 금융감독원 <strong>DART(전자공시시스템)</strong> OpenAPI에서 직접 가져옵니다.
                삼성전자, SK하이닉스, NAVER 등 주요 기업의 IFRS 연결재무제표를 기반으로 하며,
                연간 4개년 + 분기 4개 분기 데이터를 제공합니다.
                DART에 등록되지 않은 소규모 기업은 추정 데이터로 대체될 수 있습니다.
              </p>
            }
          />
          <FAQItem
            q="RS 점수는 어떻게 계산하나요?"
            a={
              <p>
                RS(Relative Strength) 점수는 <strong>Mark Minervini</strong> 방식을 따릅니다.
                1년 가격 수익률을 분석 대상 종목 전체와 비교해 백분위 점수(0~100)를 산출합니다.
                RS 80 이상이면 시장 대비 상위 20% 강세 종목임을 의미합니다.
                데이터는 Yahoo Finance v8 1년 일봉 차트를 기반으로 합니다.
              </p>
            }
          />
          <FAQItem
            q="사이드바를 접을 수 있나요?"
            a={
              <p>
                사이드바 우측 상단의 <strong>화살표(&lt;) 버튼</strong>을 클릭하면 사이드바가 접혀 아이콘만 표시됩니다.
                화면이 좁을 때 콘텐츠 영역을 넓게 활용할 수 있습니다.
                접힌 상태에서 아이콘 위에 마우스를 올리면 메뉴명 툴팁이 표시됩니다.
              </p>
            }
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="pb-6 text-center space-y-1">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          희스탁 (HeeStock) · Powered by Claude AI · v0.1.0
        </p>
        <p className="text-xs text-slate-300 dark:text-slate-700">
          본 앱의 모든 데이터·분석은 투자 참고용이며 투자 권유가 아닙니다.
        </p>
      </div>

    </div>
  );
}
