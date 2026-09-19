import type { MarketDataProvider } from "../types";
import { MockMarketDataProvider } from "./mock";

let instance: MarketDataProvider | null = null;

/**
 * Chooses the active provider from MARKET_DATA_PROVIDER. Only "mock" exists today;
 * Alpaca / Polygon / Finnhub adapters plug in here without touching the UI.
 */
export function getMarketDataProvider(): MarketDataProvider {
  if (instance) return instance;
  const requested = process.env.MARKET_DATA_PROVIDER ?? "mock";
  switch (requested) {
    case "mock":
      instance = new MockMarketDataProvider();
      break;
    default:
      console.warn(`Unknown MARKET_DATA_PROVIDER "${requested}", falling back to mock.`);
      instance = new MockMarketDataProvider();
  }
  return instance;
}
