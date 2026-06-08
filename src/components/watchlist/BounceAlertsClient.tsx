"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import { BounceAlertsSection } from "./BounceAlertsSection";

export function BounceAlertsClient() {
  const { watchlist, hydrated } = useWatchlist();

  if (!hydrated) return null;

  return <BounceAlertsSection watchlist={watchlist} />;
}
