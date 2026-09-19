import type { MarketDataProvider } from "../types";
import { AlpacaMarketDataProvider } from "./alpaca";
import { MockMarketDataProvider } from "./mock";
import { ResilientProvider } from "./resilient";

let instance: MarketDataProvider | null = null;

/**
 * Chooses the active provider from MARKET_DATA_PROVIDER. Live providers are wrapped so a
 * failure falls back to modeled data instead of an empty dashboard. To add Polygon or
 * Finnhub, implement MarketDataProvider in providers/<name>.ts and add a case here.
 */
export function getMarketDataProvider(): MarketDataProvider {
  if (instance) return instance;
  const requested = (process.env.MARKET_DATA_PROVIDER ?? "mock").toLowerCase();
  const mock = new MockMarketDataProvider();

  switch (requested) {
    case "mock":
      instance = mock;
      break;
    case "alpaca": {
      const key = process.env.MARKET_DATA_API_KEY;
      const secret = process.env.MARKET_DATA_API_SECRET;
      if (!key || !secret) {
        console.warn(
          "MARKET_DATA_PROVIDER=alpaca but MARKET_DATA_API_KEY / MARKET_DATA_API_SECRET are missing; using mock.",
        );
        instance = mock;
      } else {
        instance = new ResilientProvider(new AlpacaMarketDataProvider(key, secret), mock);
      }
      break;
    }
    default:
      console.warn(`Unknown MARKET_DATA_PROVIDER "${requested}", falling back to mock.`);
      instance = mock;
  }
  return instance;
}
