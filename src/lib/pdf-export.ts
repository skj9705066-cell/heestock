import type { CellHookData } from "jspdf-autotable";
import type { FinancialData, FinancialReport } from "@/types/financial";

// ── Font cache ───────────────────────────────────────────────────────────────
let _fontB64: string | null = null;

async function loadFont(): Promise<string | null> {
  if (_fontB64) return _fontB64;
  try {
    const res = await fetch("/fonts/NanumGothic-Regular.ttf");
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    _fontB64 = btoa(bin);
    return _fontB64;
  } catch {
    return null;
  }
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmtA(v: number | undefined): string {
  if (v === undefined) return "—";
  return v.toLocaleString("ko-KR");
}
function fmtP(v: number | undefined): string {
  if (v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// ── Row definitions ──────────────────────────────────────────────────────────
type RowDef = { label: string; key: keyof FinancialReport; type: "amount" | "pct"; bold?: boolean };

const INCOME_ROWS: RowDef[] = [
  { label: "매출액",       key: "revenue",          type: "amount", bold: true  },
  { label: "  매출총이익", key: "grossProfit",       type: "amount"              },
  { label: "영업이익",     key: "operatingIncome",  type: "amount", bold: true  },
  { label: "  영업이익률", key: "operatingMargin",  type: "pct"                 },
  { label: "당기순이익",   key: "netIncome",        type: "amount", bold: true  },
  { label: "  순이익률",   key: "netMargin",        type: "pct"                 },
  { label: "EBITDA",      key: "ebitda",            type: "amount"              },
];
const BALANCE_ROWS: RowDef[] = [
  { label: "자산총계",     key: "totalAssets",      type: "amount", bold: true  },
  { label: "부채총계",     key: "totalLiabilities", type: "amount"              },
  { label: "자본총계",     key: "totalEquity",      type: "amount"              },
  { label: "  부채비율",   key: "debtRatio",        type: "pct"                 },
];
const CF_ROWS: RowDef[] = [
  { label: "영업활동 CF",  key: "operatingCashFlow", type: "amount", bold: true },
  { label: "CAPEX",        key: "capex",              type: "amount"             },
  { label: "FCF",          key: "freeCashFlow",       type: "amount", bold: true },
];

// ── Financial PDF generator ──────────────────────────────────────────────────
export async function generateFinancialPDF(
  data: FinancialData,
  aiAnalysis: string | undefined,
  filename: string,
): Promise<void> {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableMod as any).default ?? autoTableMod;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;

  // ── Register Korean font ──
  const fontB64 = await loadFont();
  const FONT = fontB64 ? "NanumGothic" : "helvetica";
  if (fontB64) {
    doc.addFileToVFS("NanumGothic-Regular.ttf", fontB64);
    doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");
  }

  const sf = (sz: number, rgb: [number, number, number] = [30, 41, 59]) => {
    doc.setFont(FONT, "normal");
    doc.setFontSize(sz);
    doc.setTextColor(...rgb);
  };

  // ── Header bar ──
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, W, 30, "F");

  sf(17, [255, 255, 255]);
  doc.text(data.name, ML, 13);

  sf(8, [186, 210, 255]);
  doc.text(
    `${data.symbol}  ·  ${data.market === "KR" ? "한국 주식" : "미국 주식"}  ·  단위: ${data.unit}`,
    ML, 21,
  );
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Seoul",
  });
  doc.text(`생성일: ${today}`, W - MR, 17, { align: "right" });
  sf(7.5, [186, 210, 255]);
  doc.text("희스탁 · HeeStock", W - MR, 24, { align: "right" });

  // ── Build table body ──
  const reports = data.annual;
  const periods  = reports.map(r => r.period);

  type CellInput = string | { content: string; colSpan: number; styles: Record<string, unknown> };

  const sectionRow = (title: string): CellInput[] => [{
    content: title,
    colSpan: 1 + periods.length,
    styles: {
      fillColor: [241, 245, 249],
      textColor: [100, 116, 139],
      fontStyle: "bold",
      fontSize: 7.5,
      font: FONT,
      cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
    },
  }];

  const dataRows = (rows: RowDef[]): CellInput[][] =>
    rows
      .filter(row => reports.some(r => r[row.key] !== undefined))
      .map(row => [
        row.label,
        ...reports.map(r => {
          const v = r[row.key] as number | undefined;
          return row.type === "pct" ? fmtP(v) : fmtA(v);
        }),
      ]);

  const tableBody: CellInput[][] = [
    sectionRow("손익계산서"),
    ...dataRows(INCOME_ROWS),
    sectionRow("재무상태표"),
    ...dataRows(BALANCE_ROWS),
    sectionRow("현금흐름표"),
    ...dataRows(CF_ROWS),
  ];

  // Column alignment: label left, numbers right
  const colStyles: Record<number, { halign: "right" | "left" }> = { 0: { halign: "left" } };
  for (let i = 1; i <= periods.length; i++) colStyles[i] = { halign: "right" };

  autoTable(doc, {
    startY: 36,
    head: [[`항목 (${data.unit})`, ...periods]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      font: FONT,
      fontSize: 8.5,
      fontStyle: "bold",
      fillColor: [248, 250, 252],
      textColor: [51, 65, 85],
      halign: "right",
      lineWidth: { bottom: 0.5 },
      lineColor: [226, 232, 240],
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    bodyStyles: {
      font: FONT,
      fontSize: 8.5,
      textColor: [30, 41, 59],
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.3 },
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: false },
    columnStyles: colStyles,
    didParseCell: (d: CellHookData) => {
      if (d.section === "head" && d.column.index > 0) {
        d.cell.styles.halign = "right";
      }
      if (d.section === "body") {
        const raw = typeof d.cell.raw === "string" ? d.cell.raw : "";
        const n = parseFloat(raw.replace(/,/g, ""));
        if (!isNaN(n) && n < 0) {
          d.cell.styles.textColor = [239, 68, 68] as unknown as string;
        }
      }
    },
    margin: { left: ML, right: MR },
  });

  // ── AI Analysis ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? 36;
  let y = tableEndY + 10;

  if (aiAnalysis?.trim()) {
    if (y > 245) { doc.addPage(); y = 20; }

    sf(10, [29, 78, 216]);
    doc.text("AI 재무 분석  (Claude AI)", ML, y);
    y += 5;

    const cleanText = aiAnalysis
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "• ")
      .trim();

    const lines: string[] = doc.splitTextToSize(cleanText, CW - 8);
    const LH  = 4.5;
    const bH  = lines.length * LH + 8;

    doc.setFillColor(239, 246, 255);
    doc.rect(ML, y, CW, bH, "F");
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1.2);
    doc.line(ML, y, ML, y + bH);

    sf(8.2, [51, 65, 85]);
    doc.text(lines, ML + 5, y + 5);
    y += bH + 8;
  }

  // ── Footer (all pages) ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(ML, 284, W - MR, 284);
    sf(7, [148, 163, 184]);
    doc.text(
      "본 보고서는 투자 참고용이며 투자 권유가 아닙니다." +
        (data.isMock ? " (일부 추정 데이터 포함)" : ""),
      ML, 289,
    );
    doc.text(
      `Powered by 희스탁 · claude-sonnet-4-6  |  ${p} / ${pageCount}`,
      W - MR, 289, { align: "right" },
    );
  }

  doc.save(filename);
}

// ── html2canvas export — AI analysis page ────────────────────────────────────
export async function exportElementAsPDF(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
    allowTaint: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdfW = 210;
  const pdfH = 297;
  const imgW = pdfW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  if (imgH <= pdfH) {
    pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
  } else {
    let rendered = 0;
    while (rendered < imgH) {
      if (rendered > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -rendered, imgW, imgH);
      rendered += pdfH;
    }
  }
  pdf.save(filename);
}
