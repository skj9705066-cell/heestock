import { NextRequest } from "next/server";
import { buildStockSnapshot, type Market } from "@/lib/stock-snapshot";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const revalidate  = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const marketParam = req.nextUrl.searchParams.get("market")?.trim().toUpperCase();
  const market = marketParam === "KR" || marketParam === "US" ? (marketParam as Market) : undefined;

  if (!symbol) {
    return Response.json({ error: "symbol parameter required" }, { status: 400 });
  }

  try {
    const snapshot = await buildStockSnapshot(symbol, name || symbol, market);

    // 디버그: Vercel 환경에서 KIS 에러 추적
    const debug: any = {};
    if (!snapshot.quote) {
      debug.quote_missing = true;
      debug.errors = snapshot.errors;
      debug.env_check = {
        KIS_APP_KEY: process.env.KIS_APP_KEY ? `존재 (${process.env.KIS_APP_KEY.substring(0, 4)}...)` : "누락",
        KIS_APP_SECRET: process.env.KIS_APP_SECRET ? `존재 (${process.env.KIS_APP_SECRET.substring(0, 4)}...)` : "누락",
      };
    }

    return Response.json({ ...snapshot, _debug: debug }, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (err) {
    console.error("[stock-snapshot] error:", err);
    return Response.json(
      {
        error: "snapshot build failed",
        message: (err as Error).message,
        stack: (err as Error).stack,
      },
      { status: 500 },
    );
  }
}
