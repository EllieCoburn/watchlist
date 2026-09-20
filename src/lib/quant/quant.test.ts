import { describe, expect, it } from "vitest";
import type { DailyBar } from "@/lib/market-data/types";
import { resolveHorizon } from "./calendar";
import { empiricalBarrierAnalysis } from "./empirical";
import { runSimulation } from "./engine";
import { expectedValue } from "./ev";
import { explainSimulation } from "./explain";
import { runMonteCarlo } from "./monte-carlo";
import { createRng, createWeightedSampler, hashSeed } from "./rng";
import {
  ewmaVolatility,
  excessKurtosis,
  mean,
  percentile,
  returnSamples,
  skewness,
  std,
  volatilityRegime,
} from "./stats";

const edt = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 4, min);

/** Synthetic but realistic daily bars: geometric random walk with intraday ranges. */
function syntheticBars(n: number, seed: number, dailyVol = 0.02, start = 100): DailyBar[] {
  const rng = createRng(seed);
  const bars: DailyBar[] = [];
  let close = start;
  let t = Date.UTC(2025, 8, 1);
  for (let i = 0; i < n; i++) {
    t += 86_400_000;
    const day = new Date(t).getUTCDay();
    if (day === 0 || day === 6) continue;
    const gap = rng.gaussian() * dailyVol * 0.3;
    const open = close * Math.exp(gap);
    const intraday = rng.gaussian() * dailyVol * 0.9;
    const c = open * Math.exp(intraday);
    const extra = Math.abs(rng.gaussian()) * dailyVol * 0.5;
    const high = Math.max(open, c) * Math.exp(extra);
    const low = Math.min(open, c) * Math.exp(-extra);
    bars.push({ t, open, high, low, close: c });
    close = c;
  }
  return bars;
}

describe("rng", () => {
  it("is deterministic per seed and roughly standard normal", () => {
    const a = createRng(hashSeed("x"));
    const b = createRng(hashSeed("x"));
    expect(a.uniform()).toBe(b.uniform());
    const xs = Array.from({ length: 20_000 }, () => createRng(1).gaussian());
    void xs;
    const r = createRng(7);
    const g = Array.from({ length: 50_000 }, () => r.gaussian());
    expect(Math.abs(mean(g))).toBeLessThan(0.02);
    expect(Math.abs(std(g) - 1)).toBeLessThan(0.02);
  });

  it("weighted sampler follows the weights", () => {
    const sample = createWeightedSampler([1, 3]);
    const r = createRng(3);
    let ones = 0;
    for (let i = 0; i < 20_000; i++) if (sample(r) === 1) ones++;
    expect(ones / 20_000).toBeGreaterThan(0.72);
    expect(ones / 20_000).toBeLessThan(0.78);
  });
});

describe("stats", () => {
  it("computes basic moments", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(Math.abs(skewness([1, 2, 3, 4, 5]))).toBeLessThan(1e-9);
    expect(excessKurtosis([1, 2, 3, 4, 5])).toBeLessThan(0);
  });

  it("derives return samples from bars", () => {
    const s = returnSamples([
      { t: 1, open: 100, high: 101, low: 99, close: 100 },
      { t: 2, open: 102, high: 104, low: 101, close: 103 },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].gap).toBeCloseTo(Math.log(1.02));
    expect(s[0].daily).toBeCloseTo(Math.log(1.03));
    expect(s[0].intraday).toBeCloseTo(Math.log(103 / 102));
    expect(s[0].range).toBeCloseTo(3 / 102);
  });

  it("ewma volatility tracks the recent level and regime classifies", () => {
    const calm = Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.005 : -0.005));
    const wild = [...calm, ...Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.04 : -0.04))];
    expect(ewmaVolatility(wild)).toBeGreaterThan(ewmaVolatility(calm) * 3);
    expect(volatilityRegime(wild).regime).toBe("extreme");
  });
});

describe("calendar", () => {
  it("resolves horizons on the trading calendar", () => {
    const saturday = edt(2026, 9, 19, 12);
    const today = resolveHorizon({ type: "today" }, saturday);
    expect(today.sessions).toHaveLength(1);
    expect(today.sessions[0].dateKey).toBe("2026-09-21");
    expect(today.note).not.toBeNull();
    const next = resolveHorizon({ type: "next" }, saturday);
    expect(next.sessions[0].dateKey).toBe("2026-09-21");
    expect(next.sessions[0].hasGap).toBe(true);
    const custom = resolveHorizon({ type: "custom", days: 3 }, saturday);
    expect(custom.sessions.map((s) => s.dateKey)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
  });

  it("uses the remaining session when the market is open", () => {
    const friday11 = edt(2026, 9, 18, 11);
    const today = resolveHorizon({ type: "today" }, friday11);
    expect(today.startsIntraday).toBe(true);
    expect(today.sessions[0].fraction).toBeCloseTo(5 / 6.5, 2);
    expect(today.sessions[0].hasGap).toBe(false);
    const next = resolveHorizon({ type: "next" }, friday11);
    expect(next.sessions[0].dateKey).toBe("2026-09-21");
  });

  it("skips the Labor Day holiday", () => {
    const fri = edt(2026, 9, 4, 18);
    const custom = resolveHorizon({ type: "custom", days: 2 }, fri);
    expect(custom.sessions.map((s) => s.dateKey)).toEqual(["2026-09-08", "2026-09-09"]);
  });
});

describe("monte carlo", () => {
  const bars = syntheticBars(400, 11);
  const samples = returnSamples(bars);
  const session = { open: 0, close: 0, fraction: 1, hasGap: true, dateKey: "d" };

  it("is reproducible for the same seed", () => {
    const a = runMonteCarlo({
      entry: 100,
      target: 101,
      stop: 98,
      sessions: [session],
      samples,
      regimeScale: 1,
      paths: 5000,
      seed: "s",
    });
    const b = runMonteCarlo({
      entry: 100,
      target: 101,
      stop: 98,
      sessions: [session],
      samples,
      regimeScale: 1,
      paths: 5000,
      seed: "s",
    });
    expect(a.counts).toEqual(b.counts);
  });

  it("touches a nearer barrier more often and keeps probabilities consistent", () => {
    const r = runMonteCarlo({
      entry: 100,
      target: 100.5,
      stop: 96,
      sessions: [session],
      samples,
      regimeScale: 1,
      paths: 20_000,
      seed: "s2",
    });
    const p = r.probabilities;
    expect(p.targetTouched).toBeGreaterThan(p.stopTouched * 2);
    expect(p.targetFirst + p.stopFirst + p.neither).toBeCloseTo(1, 10);
    expect(p.targetTouched).toBeCloseTo(
      p.targetFirst + p.both - (p.both - (p.targetTouched - p.targetFirst)),
      10,
    );
    expect(p.both).toBeLessThanOrEqual(Math.min(p.targetTouched, p.stopTouched));
  });

  it("is roughly symmetric for symmetric barriers", () => {
    const r = runMonteCarlo({
      entry: 100,
      target: 102,
      stop: 98.04,
      sessions: [session],
      samples,
      regimeScale: 1,
      paths: 30_000,
      seed: "sym",
    });
    expect(Math.abs(r.probabilities.targetFirst - r.probabilities.stopFirst)).toBeLessThan(0.08);
  });

  it("calibrates the intraday range to history", () => {
    const r = runMonteCarlo({
      entry: 100,
      target: 110,
      stop: 90,
      sessions: [session],
      samples,
      regimeScale: 1,
      paths: 2000,
      seed: "c",
    });
    expect(
      Math.abs(r.calibration.calibratedRange - r.calibration.targetRange) /
        r.calibration.targetRange,
    ).toBeLessThan(0.15);
  });

  it("finishes 100k paths for one session quickly", () => {
    const t = Date.now();
    runMonteCarlo({
      entry: 100,
      target: 101,
      stop: 98,
      sessions: [session],
      samples,
      regimeScale: 1,
      paths: 100_000,
      seed: "perf",
    });
    expect(Date.now() - t).toBeLessThan(4000);
  });
});

describe("empirical", () => {
  it("counts normalized excursions and infers order", () => {
    const bars: DailyBar[] = [
      { t: 1, open: 100, high: 100, low: 100, close: 100 },
      { t: 2, open: 100, high: 103, low: 99.5, close: 102 }, // +3% hit target, -0.5% no stop
      { t: 3, open: 102, high: 102.5, low: 97, close: 98 }, // from 102: -4.9% hits stop
      { t: 4, open: 98, high: 101.5, low: 94, close: 100 }, // both: up +3.6% and down -4.1% from 98; close>open → low first
      { t: 5, open: 100, high: 100.5, low: 99.8, close: 100.2 }, // neither
    ];
    const e = empiricalBarrierAnalysis(bars, 0.02, -0.03, 1, false);
    expect(e.sessions).toBe(4);
    expect(e.counts.target).toBe(2);
    expect(e.counts.stop).toBe(2);
    expect(e.counts.both).toBe(1);
    expect(e.counts.neither).toBe(1);
    expect(e.counts.targetFirst).toBe(1);
    expect(e.counts.stopFirst).toBe(2);
    expect(e.orderInferredShare).toBe(1);
  });
});

describe("expected value", () => {
  it("separates barrier-only EV from marked-to-market EV", () => {
    const ev = expectedValue(47.46, 48, 45.5, 0.6, 0.2, 0.2, 47.6, 100);
    expect(ev.gainPerShare).toBeCloseTo(0.54);
    expect(ev.lossPerShare).toBeCloseTo(1.96);
    expect(ev.rewardToRisk).toBeCloseTo(0.2755, 3);
    expect(ev.evPerShareBarriersOnly).toBeCloseTo(0.6 * 0.54 - 0.2 * 1.96);
    expect(ev.evPerShare).toBeCloseTo(ev.evPerShareBarriersOnly + 0.2 * (47.6 - 47.46));
    expect(ev.expectedProfit).toBeCloseTo(ev.evPerShare * 100);
  });
});

describe("engine", () => {
  it("runs end to end on synthetic bars and explains itself", () => {
    const bars = syntheticBars(380, 5, 0.025, 47);
    const r = runSimulation(
      {
        ticker: "TEST",
        entry: 47.46,
        target: 48,
        stop: 45.5,
        horizon: { type: "next" },
        shares: 100,
      },
      bars,
      { now: edt(2026, 9, 19, 12), paths: 20_000, dataSource: "synthetic" },
    );
    const p = r.monteCarlo.probabilities;
    expect(p.targetFirst + p.stopFirst + p.neither).toBeCloseTo(1, 10);
    expect(r.barriers.target.percent).toBeCloseTo(0.01138, 4);
    expect(r.barriers.stop.percent).toBeCloseTo(-0.0413, 3);
    expect(r.empirical?.sessions).toBeGreaterThan(40);
    expect(r.confidence.paths).toBe(20_000);
    const text = explainSimulation(r);
    expect(text.summary).toContain("TEST");
    expect(text.summary).toMatch(/\d+% of paths/);
    expect(text.caveat).toMatch(/not a prediction/);
  });

  it("refuses invalid barrier setups", () => {
    const bars = syntheticBars(100, 1);
    expect(() =>
      runSimulation(
        { ticker: "T", entry: 100, target: 99, stop: 95, horizon: { type: "next" }, shares: null },
        bars,
        { dataSource: "x" },
      ),
    ).toThrow(/Target/);
  });
});
