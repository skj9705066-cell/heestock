import { NextRequest } from "next/server";
import { buildStockSnapshot, type Market } from "@/lib/stock-snapshot";

export const runtime = "nodejs";
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
    return Response.json(snapshot);
  } catch (err) {
    console.error("[stock-snapshot] error:", err);
    return Response.json(
      { error: "snapshot build failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
