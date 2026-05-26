"use client";

import { cn } from "@/lib/utils";
import type { FinancialData, FinancialReport } from "@/types/financial";

interface FinancialTableProps {
  data: FinancialData;
  mode: "annual" | "quarterly";
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtAmount(v: number | undefined): string {
  if (v === undefined) return "—";
  return v.toLocaleString("ko-KR");
}

function fmtPct(v: number | undefined): string {
  if (v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function numColor(v: number | undefined): string {
  if (v === undefined) return "text-slate-400";
  return v < 0 ? "text-red-500 dark:text-red-400" : "text-slate-800 dark:text-slate-100";
}

function pctColor(v: number | undefined): string {
  if (v === undefined) return "text-slate-400";
  return v < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
}

// ── Row definitions ──────────────────────────────────────────────────────────

type RowDef = {
  label: string;
  key: keyof FinancialReport;
  type: "amount" | "pct";
  indent?: boolean;
  bold?: boolean;
  hideInQ?: boolean; // 분기에서 숨김
};

const INCOME_ROWS: RowDef[] = [
  { label: "매출액",      key: "revenue",          type: "amount", bold: true },
  { label: "매출총이익",   key: "grossProfit",      type: "amount", hideInQ: true },
  { label: "영업이익",     key: "operatingIncome",  type: "amount", bold: true },
  { label: "  영업이익률", key: "operatingMargin",  type: "pct",    indent: true },
  { label: "당기순이익",   key: "netIncome",        type: "amount", bold: true },
  { label: "  순이익률",   key: "netMargin",        type: "pct",    indent: true },
  { label: "EBITDA",     key: "ebitda",            type: "amount", hideInQ: true },
];

const BALANCE_ROWS: RowDef[] = [
  { label: "자산총계",     key: "totalAssets",      type: "amount", bold: true },
  { label: "부채총계",     key: "totalLiabilities", type: "amount" },
  { label: "자본총계",     key: "totalEquity",      type: "amount" },
  { label: "  부채비율",   key: "debtRatio",        type: "pct",    indent: true },
];

const CF_ROWS: RowDef[] = [
  { label: "영업활동 CF",  key: "operatingCashFlow", type: "amount", bold: true },
  { label: "CAPEX",       key: "capex",              type: "amount" },
  { label: "FCF",         key: "freeCashFlow",       type: "amount", bold: true },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <tr>
      <td
        colSpan={99}
        className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700"
      >
        {title}
      </td>
    </tr>
  );
}

function DataRow({
  row,
  reports,
  isQ,
}: {
  row: RowDef;
  reports: FinancialReport[];
  isQ: boolean;
}) {
  if (row.hideInQ && isQ) return null;

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <td
        className={cn(
          "px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap",
          row.indent && "pl-8",
          row.bold && "font-semibold text-slate-800 dark:text-slate-200",
        )}
      >
        {row.label}
      </td>
      {reports.map((r) => {
        const v = r[row.key] as number | undefined;
        const formatted = row.type === "pct" ? fmtPct(v) : fmtAmount(v);
        const colorCls  = row.type === "pct" ? pctColor(v) : numColor(v);

        return (
          <td
            key={r.period}
            className={cn(
              "px-4 py-2.5 text-right text-sm font-mono whitespace-nowrap",
              colorCls,
              row.bold && "font-semibold",
            )}
          >
            {formatted}
          </td>
        );
      })}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FinancialTable({ data, mode }: FinancialTableProps) {
  const reports  = mode === "annual" ? data.annual : data.quarterly;
  const isQ      = mode === "quarterly";
  const colCount = reports.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {/* ── Header ── */}
        <thead>
          <tr className="border-b-2 border-slate-200 dark:border-slate-700">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-44">
              항목 <span className="text-slate-300 dark:text-slate-600 font-normal">({data.unit})</span>
            </th>
            {reports.map((r) => (
              <th
                key={r.period}
                className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase"
              >
                {r.period}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* 손익계산서 */}
          <SectionHeader title="손익계산서" />
          {INCOME_ROWS.map((row) => (
            <DataRow key={row.key} row={row} reports={reports} isQ={isQ} />
          ))}

          {/* 재무상태표 (연간만) */}
          {!isQ && (
            <>
              <SectionHeader title="재무상태표" />
              {BALANCE_ROWS.map((row) => (
                <DataRow key={row.key} row={row} reports={reports} isQ={isQ} />
              ))}
            </>
          )}

          {/* 현금흐름표 */}
          <SectionHeader title="현금흐름표" />
          {CF_ROWS.map((row) => (
            <DataRow key={row.key} row={row} reports={reports} isQ={isQ} />
          ))}
        </tbody>
      </table>

      {data.isMock && (
        <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 px-4 flex items-center gap-1">
          ⚠ 일부 항목은 추정 데이터입니다. Alpha Vantage API 키 연동 시 실제 데이터를 사용합니다.
        </p>
      )}
    </div>
  );
}
