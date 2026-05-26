import { NextRequest } from "next/server";
import {
  getMarketIndices,
  getTopStocks,
  getSectors,
  getInvestorFlow,
  getCommoditiesAndBonds,
} from "@/lib/market-data";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "all";

  try {
    switch (type) {
      case "indices": {
        const data = await getMarketIndices();
        return Response.json(data);
      }
      case "top-stocks": {
        const data = await getTopStocks();
        return Response.json(data);
      }
      case "sectors": {
        const data = await getSectors();
        return Response.json(data);
      }
      case "investor-flow": {
        const indices = await getMarketIndices();
        const data    = await getInvestorFlow(indices);
        return Response.json(data);
      }
      case "commodities": {
        const data = await getCommoditiesAndBonds();
        return Response.json(data);
      }
      default: {
        const [indices, topStocks, sectors, commodities] = await Promise.allSettled([
          getMarketIndices(),
          getTopStocks(),
          getSectors(),
          getCommoditiesAndBonds(),
        ]);
        const idxData = indices.status  === "fulfilled" ? indices.value  : [];
        const invFlow = await getInvestorFlow(idxData);
        return Response.json({
          indices:      idxData,
          sectors:      sectors.status      === "fulfilled" ? sectors.value      : [],
          investorFlow: invFlow,
          topStocks:    topStocks.status    === "fulfilled" ? topStocks.value    : [],
          commodities:  commodities.status  === "fulfilled" ? commodities.value  : { wti: null, brent: null, tnx: null },
        });
      }
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
