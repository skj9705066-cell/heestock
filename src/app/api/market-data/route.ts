import { NextRequest } from "next/server";
import {
  getMarketIndices,
  getTopStocks,
  getSectors,
  getMarketVolumeTrend,
  getCommoditiesAndBonds,
} from "@/lib/market-data";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, must-revalidate" } as const;

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "all";

  try {
    switch (type) {
      case "indices": {
        const data = await getMarketIndices();
        return Response.json(data, { headers: NO_STORE });
      }
      case "top-stocks": {
        const data = await getTopStocks();
        return Response.json(data, { headers: NO_STORE });
      }
      case "sectors": {
        const data = await getSectors();
        return Response.json(data, { headers: NO_STORE });
      }
      case "volume-trend": {
        const data = await getMarketVolumeTrend();
        return Response.json(data, { headers: NO_STORE });
      }
      case "commodities": {
        const data = await getCommoditiesAndBonds();
        return Response.json(data, { headers: NO_STORE });
      }
      default: {
        const [indices, topStocks, sectors, volumeTrend, commodities] = await Promise.allSettled([
          getMarketIndices(),
          getTopStocks(),
          getSectors(),
          getMarketVolumeTrend(),
          getCommoditiesAndBonds(),
        ]);
        return Response.json({
          indices:     indices.status     === "fulfilled" ? indices.value     : [],
          sectors:     sectors.status     === "fulfilled" ? sectors.value     : [],
          volumeTrend: volumeTrend.status === "fulfilled" ? volumeTrend.value : [],
          topStocks:   topStocks.status   === "fulfilled" ? topStocks.value   : [],
          commodities: commodities.status === "fulfilled" ? commodities.value : { wti: null, brent: null, tnx: null },
        }, { headers: NO_STORE });
      }
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE });
  }
}
