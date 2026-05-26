import type { FinancialData, FinancialReport } from "@/types/financial";

interface Props {
  data: FinancialData;
  aiAnalysis?: string;
}

// 인라인 스타일만 사용 (Tailwind 없음) → html2canvas 에서 신뢰도 높은 렌더링

function fmtA(v: number | undefined) {
  if (v === undefined) return "—";
  return v.toLocaleString("ko-KR");
}
function fmtP(v: number | undefined) {
  if (v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function color(v: number | undefined, isPct = false) {
  if (v === undefined) return "#64748b";
  return v < 0 ? "#ef4444" : isPct ? "#059669" : "#1e293b";
}

type Row = { label: string; key: keyof FinancialReport; type: "amount" | "pct"; indent?: boolean };

const ROWS: Row[] = [
  { label: "매출액",       key: "revenue",           type: "amount" },
  { label: "  매출총이익", key: "grossProfit",        type: "amount", indent: true },
  { label: "영업이익",     key: "operatingIncome",   type: "amount" },
  { label: "  영업이익률", key: "operatingMargin",   type: "pct",    indent: true },
  { label: "당기순이익",   key: "netIncome",         type: "amount" },
  { label: "  순이익률",   key: "netMargin",         type: "pct",    indent: true },
  { label: "EBITDA",     key: "ebitda",             type: "amount" },
  { label: "자산총계",     key: "totalAssets",       type: "amount" },
  { label: "부채총계",     key: "totalLiabilities",  type: "amount" },
  { label: "자본총계",     key: "totalEquity",       type: "amount" },
  { label: "  부채비율",   key: "debtRatio",         type: "pct",    indent: true },
  { label: "영업활동 CF",  key: "operatingCashFlow", type: "amount" },
  { label: "CAPEX",      key: "capex",              type: "amount" },
  { label: "FCF",        key: "freeCashFlow",       type: "amount" },
];

function Section({ title }: { title: string }) {
  return (
    <tr>
      <td
        colSpan={99}
        style={{ background:"#f1f5f9", padding:"6px 12px", fontSize:10, fontWeight:700,
                 color:"#64748b", letterSpacing:"0.08em", textTransform:"uppercase",
                 borderBottom:"1px solid #e2e8f0" }}
      >
        {title}
      </td>
    </tr>
  );
}

export function FinancialPDFTemplate({ data, aiAnalysis }: Props) {
  const reports = data.annual;

  return (
    <div style={{ fontFamily:"'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
                  background:"#ffffff", color:"#1e293b", padding:"40px 44px", width:"860px" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom:"3px solid #1d4ed8", paddingBottom:16, marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, margin:0, color:"#0f172a" }}>
              {data.name}
              <span style={{ fontSize:14, fontWeight:400, color:"#64748b", marginLeft:10 }}>
                {data.symbol}
              </span>
            </h1>
            <p style={{ margin:"4px 0 0", fontSize:12, color:"#64748b" }}>
              재무제표 분석 리포트 · {data.market === "KR" ? "한국 주식" : "미국 주식"}
            </p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ margin:0, fontSize:11, color:"#94a3b8" }}>
              생성일: {new Date().toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric" })}
            </p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:"#94a3b8" }}>단위: {data.unit}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:"#3b82f6", fontWeight:700 }}>
              희스탁 · HeeStock
            </p>
          </div>
        </div>
      </div>

      {/* ── Financial Table ── */}
      <h2 style={{ fontSize:14, fontWeight:700, color:"#1e293b", margin:"0 0 10px" }}>
        연간 재무 지표
      </h2>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            <th style={{ textAlign:"left", padding:"8px 12px", color:"#64748b", fontSize:11, width:140 }}>
              항목
            </th>
            {reports.map(r => (
              <th key={r.period} style={{ textAlign:"right", padding:"8px 12px", color:"#1e293b", fontWeight:700 }}>
                {r.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Section title="손익계산서" />
          {ROWS.slice(0, 7).map(row => {
            if (!reports.some(r => r[row.key] !== undefined)) return null;
            return (
              <tr key={row.key} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"6px 12px", color:"#475569", paddingLeft: row.indent ? 28 : 12, fontSize:11 }}>
                  {row.label}
                </td>
                {reports.map(r => {
                  const v = r[row.key] as number | undefined;
                  return (
                    <td key={r.period} style={{ textAlign:"right", padding:"6px 12px",
                                                fontFamily:"monospace", color: color(v, row.type==="pct"),
                                                fontWeight: row.type==="amount" && !row.indent ? 600 : 400 }}>
                      {row.type === "pct" ? fmtP(v) : fmtA(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          <Section title="재무상태표" />
          {ROWS.slice(7, 11).map(row => (
            <tr key={row.key} style={{ borderBottom:"1px solid #f1f5f9" }}>
              <td style={{ padding:"6px 12px", color:"#475569", paddingLeft: row.indent ? 28 : 12, fontSize:11 }}>
                {row.label}
              </td>
              {reports.map(r => {
                const v = r[row.key] as number | undefined;
                return (
                  <td key={r.period} style={{ textAlign:"right", padding:"6px 12px",
                                              fontFamily:"monospace", color: color(v, row.type==="pct"),
                                              fontWeight: !row.indent ? 600 : 400 }}>
                    {row.type === "pct" ? fmtP(v) : fmtA(v)}
                  </td>
                );
              })}
            </tr>
          ))}

          <Section title="현금흐름" />
          {ROWS.slice(11).map(row => (
            <tr key={row.key} style={{ borderBottom:"1px solid #f1f5f9" }}>
              <td style={{ padding:"6px 12px", color:"#475569", fontSize:11 }}>{row.label}</td>
              {reports.map(r => {
                const v = r[row.key] as number | undefined;
                return (
                  <td key={r.period} style={{ textAlign:"right", padding:"6px 12px",
                                              fontFamily:"monospace", color: color(v),
                                              fontWeight: row.key==="freeCashFlow" ? 600 : 400 }}>
                    {fmtA(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── AI Analysis ── */}
      {aiAnalysis && (
        <div style={{ marginTop:28, padding:"16px 20px",
                      background:"#eff6ff", borderLeft:"4px solid #3b82f6", borderRadius:"0 8px 8px 0" }}>
          <h2 style={{ fontSize:13, fontWeight:700, color:"#1d4ed8", margin:"0 0 8px" }}>
            AI 재무 분석 코멘트 (Claude AI)
          </h2>
          <p style={{ fontSize:11, color:"#334155", lineHeight:1.7, margin:0, whiteSpace:"pre-wrap" }}>
            {aiAnalysis}
          </p>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop:28, paddingTop:12, borderTop:"1px solid #e2e8f0",
                    display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <p style={{ fontSize:9, color:"#94a3b8", margin:0 }}>
          본 보고서는 투자 참고용이며 투자 권유가 아닙니다.
          {data.isMock ? " (일부 추정 데이터 포함)" : " 출처: Alpha Vantage / KRX"}
        </p>
        <p style={{ fontSize:9, color:"#94a3b8", margin:0 }}>
          Powered by 희스탁 (HeeStock) · claude-sonnet-4-6
        </p>
      </div>
    </div>
  );
}
