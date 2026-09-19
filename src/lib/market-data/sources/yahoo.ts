import { cached } from "../cache";
import type { PricePoint, TimeRange } from "../types";

/**
 * Yahoo Finance chart endpoint (unofficial, no key). Second-choice history source for
 * providers without history. Cached per symbol and range; fails soft.
 */

const BASE = "https://query2.finance.yahoo.com/v8/finance/chart/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: { close?: (number | null)[]; low?: (number | null)[]; high?: (number | null)[] }[];
      };
    }[];
    error?: { code?: string; description?: string } | null;
  };
};

export function toYahooSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\./g, "-");
}

export function parseYahooChart(data: YahooChart): PricePoint[] {
  const result = data.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  if (!q?.close || ts.length === 0) return [];
  const r = (v: number) => Math.round(v * 10_000) / 10_000;
  const points: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close[i];
    if (close == null || !Number.isFinite(close) || close <= 0) continue;
    const lo = q.low?.[i];
    const hi = q.high?.[i];
    points.push({
      t: ts[i] * 1000,
      price: r(close),
      low: lo != null && lo > 0 ? r(lo) : undefined,
      high: hi != null && hi > 0 ? r(hi) : undefined,
    });
  }
  return points;
}

/** Yahoo's range/interval pair for each UI range. */
export function yahooParams(range: TimeRange): { range: string; interval: string } {
  switch (range) {
    case "live":
    case "1H":
      return { range: "1d", interval: "1m" };
    case "1D":
      return { range: "1d", interval: "5m" };
    case "1W":
      return { range: "5d", interval: "15m" };
    case "1M":
      return { range: "1mo", interval: "1d" };
    case "1Y":
      return { range: "1y", interval: "1d" };
  }
}

export async function fetchYahooChart(
  symbol: string,
  rangeParam: string,
  interval: string,
): Promise<PricePoint[]> {
  const sym = toYahooSymbol(symbol);
  return cached(
    `yahoo:${sym}:${rangeParam}:${interval}`,
    rangeParam === "1d" ? 60_000 : 60 * 60_000,
    async () => {
      const url = `${BASE}${encodeURIComponent(sym)}?range=${rangeParam}&interval=${interval}&includePrePost=false&events=div%2Csplit`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Yahoo ${sym} ${rangeParam}/${interval} failed: ${res.status}`);
      const data = (await res.json()) as YahooChart;
      if (data.chart?.error)
        throw new Error(`Yahoo ${sym}: ${data.chart.error.description ?? data.chart.error.code}`);
      const points = parseYahooChart(data);
      if (points.length === 0) throw new Error(`Yahoo ${sym}: no data`);
      return points;
    },
  );
}
