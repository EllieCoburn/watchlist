import { describe, expect, it } from "vitest";
import type { DailyBar, IntradaySession } from "@/lib/market-data/types";
import { runBacktest } from "./backtest";
import { resolveHorizon } from "./calendar";
import { sanityCheck } from "./checks";
import { combineEngines } from "./combine";
import type { DataWindow } from "./data-window";
import { runAnalog } from "./engine-analog";
import { runBootstrap } from "./engine-bootstrap";
import { bridgeBar, runParametricMc } from "./engine-mc";
import { runSimulation } from "./engine";
import { explainSimulation } from "./explain";
import { featuresAsOf, rankAnalogs } from "./features";
import { evaluatePath, type PathBar } from "./path-eval";
import { resolveReference } from "./reference";
import { createRng, createWeightedSampler, hashSeed } from "./rng";
import {
  ewmaVolatility,
  excessKurtosis,
  mean,
  percentile,
  returnSamples,
  skewness,
  std,
  studentT,
  volatilityRegime,
} from "./stats";

const edt = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 4, min);

/** Synthetic but realistic daily + 5-minute history: a random walk with a U-shaped intraday profile. */
function synthetic(
  nDays: number,
  seed: number,
  dailyVol = 0.025,
  start = 100,
): { bars: DailyBar[]; sessions: IntradaySession[] } {
  const rng = createRng(seed);
  const bars: DailyBar[] = [];
  const sessions: IntradaySession[] = [];
  let close = start;
  let t = Date.UTC(2025, 5, 1);
  while (bars.length < nDays) {
    t += 86_400_000;
    const day = new Date(t).getUTCDay();
    if (day === 0 || day === 6) continue;
    const dateKey = new Date(t).toISOString().slice(0, 10);
    const gap = rng.gaussian() * dailyVol * 0.35;
    const open = close * Math.exp(gap);
    let p = open;
    const ibars: IntradaySession["bars"] = [];
    let hi = open,
      lo = open;
    const sessionOpen = Date.UTC(
      new Date(t).getUTCFullYear(),
      new Date(t).getUTCMonth(),
      new Date(t).getUTCDate(),
      13,
      30,
    );
    for (let k = 0; k < 78; k++) {
      const u = 1 + (1.5 * Math.abs(k - 39)) / 39; // U-shaped volatility
      const sd = (dailyVol * 0.9 * u) / Math.sqrt(78 * 1.4);
      const o = p;
      const c = p * Math.exp(rng.gaussian() * sd);
      const ext = Math.abs(rng.gaussian()) * sd * 0.6;
      const h = Math.max(o, c) * Math.exp(ext);
      const l = Math.min(o, c) * Math.exp(-ext);
      ibars.push({
        t: sessionOpen + k * 300_000,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 1000,
      });
      hi = Math.max(hi, h);
      lo = Math.min(lo, l);
      p = c;
    }
    bars.push({ t, open, high: hi, low: lo, close: p, volume: 1_000_000 * (0.5 + rng.uniform()) });
    sessions.push({ dateKey, bars: ibars, intervalMinutes: 5 });
    close = p;
  }
  return { bars, sessions };
}

function windowOf(n: number, seed = 7, withIntraday = true, withBench = true): DataWindow {
  const s = synthetic(n, seed);
  const bench = withBench
    ? synthetic(n, seed + 100, 0.012, 500).bars.map((b, i) => ({ ...b, t: s.bars[i].t }))
    : null;
  return {
    bars: s.bars,
    intraday: withIntraday ? s.sessions : null,
    intervalMinutes: 5,
    bench: bench ?? s.bars.map(() => null),
    benchSymbol: withBench ? "QQQ" : null,
  };
}

describe("rng and statistics", () => {
  it("is deterministic and produces unit-variance Student-t draws", () => {
    expect(createRng(hashSeed("x")).uniform()).toBe(createRng(hashSeed("x")).uniform());
    const r = createRng(9);
    const t = Array.from({ length: 60_000 }, () => studentT(r, 5));
    expect(Math.abs(mean(t))).toBeLessThan(0.03);
    expect(Math.abs(std(t) - 1)).toBeLessThan(0.05);
    expect(excessKurtosis(t)).toBeGreaterThan(1); // heavier than normal
  });

  it("computes moments, ewma and regimes", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(Math.abs(skewness([1, 2, 3, 4, 5]))).toBeLessThan(1e-9);
    const calm = Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.005 : -0.005));
    const wild = [...calm, ...Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.04 : -0.04))];
    expect(ewmaVolatility(wild)).toBeGreaterThan(ewmaVolatility(calm) * 3);
    expect(volatilityRegime(wild).regime).toBe("extreme");
    const sample = createWeightedSampler([1, 3]);
    let ones = 0;
    const rr = createRng(3);
    for (let i = 0; i < 20_000; i++) if (sample(rr) === 1) ones++;
    expect(ones / 20_000).toBeGreaterThan(0.72);
  });
});

describe("path evaluation (touch, fill, first, ambiguity)", () => {
  const L = { entry: 175, target: 177, stop: 174 };
  const bar = (open: number, high: number, low: number, close: number): PathBar => ({
    open,
    high,
    low,
    close,
  });

  it("does not fill when the entry is never reached and counts nothing after", () => {
    const o = evaluatePath([bar(177.6, 179, 176, 178)], 177.64, L);
    expect(o.filled).toBe(false);
    expect(o.targetTouched).toBe(false);
    expect(o.pnlPerShare).toBeNull();
  });

  it("fills a buy limit on the way down; a stop further down is certainly post-fill; a target above is ambiguous", () => {
    const stopOnly = evaluatePath([bar(176, 176.5, 173.5, 174.5)], 177.64, L);
    expect(stopOnly.filled).toBe(true);
    expect(stopOnly.fillPrice).toBe(175);
    expect(stopOnly.first).toBe("stop");
    const both = evaluatePath([bar(176, 177.5, 174.8, 176)], 177.64, L);
    expect(both.filled).toBe(true);
    expect(both.first).toBe("ambiguous");
    expect(both.pnlPerShare).toBeNull();
  });

  it("fills at the open when the open gaps through the entry", () => {
    const o = evaluatePath([bar(174.5, 176, 174.2, 175.5)], 177.64, L);
    expect(o.fillPrice).toBe(174.5);
    expect(o.first).toBe("none");
    expect(o.exitPrice).toBe(175.5); // end-of-horizon exit
    expect(o.pnlPerShare).toBeCloseTo(1);
  });

  it("orders touches across bars and tracks the other level afterwards", () => {
    const o = evaluatePath(
      [bar(176, 176.2, 175, 175.5), bar(175.5, 177.2, 175.3, 177), bar(177, 177.1, 173.9, 174)],
      177.64,
      L,
    );
    expect(o.first).toBe("target");
    expect(o.targetTouched && o.stopTouched).toBe(true);
    expect(o.pnlPerShare).toBeCloseTo(2);
  });

  it("marks both-in-one-bar after the fill as ambiguous rather than guessing", () => {
    const o = evaluatePath([bar(176, 176.2, 175, 175.5), bar(175.5, 177.5, 173.5, 176)], 177.64, L);
    expect(o.first).toBe("ambiguous");
  });

  it("opens immediately when the entry equals the reference", () => {
    const o = evaluatePath([bar(175, 175.5, 174.9, 175.2)], 175, L);
    expect(o.filled).toBe(true);
    expect(o.fillBar).toBe(0);
  });
});

describe("calendar and reference", () => {
  it("resolves horizons on the trading calendar including holidays", () => {
    const saturday = edt(2026, 9, 19, 12);
    expect(resolveHorizon({ type: "next" }, saturday).sessions[0].dateKey).toBe("2026-09-21");
    expect(
      resolveHorizon({ type: "custom", days: 3 }, saturday).sessions.map((s) => s.dateKey),
    ).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(
      resolveHorizon({ type: "custom", days: 2 }, edt(2026, 9, 4, 18)).sessions.map(
        (s) => s.dateKey,
      ),
    ).toEqual(["2026-09-08", "2026-09-09"]);
    const today = resolveHorizon({ type: "today" }, edt(2026, 9, 18, 11));
    expect(today.startsIntraday).toBe(true);
    expect(today.sessions[0].fraction).toBeCloseTo(5 / 6.5, 2);
  });

  it("chooses the last close on a weekend and a live price in extended hours", () => {
    const q = {
      symbol: "X",
      companyName: null,
      price: 178.2,
      previousClose: 177.64,
      change: 0.56,
      changePercent: 0.3,
      dayLow: 176,
      dayHigh: 179,
      asOf: edt(2026, 9, 18, 16),
    };
    const weekend = resolveReference(q, 177.64, edt(2026, 9, 19, 12));
    expect(weekend.kind).toBe("last-close");
    expect(weekend.price).toBe(177.64);
    const pre = resolveReference(
      { ...q, asOf: edt(2026, 9, 21, 8, 30) },
      177.64,
      edt(2026, 9, 21, 8, 35),
    );
    expect(pre.kind).toBe("premarket");
    expect(pre.price).toBe(178.2);
    expect(pre.gapScale).toBe(0.5);
    const live = resolveReference(q, 177.64, edt(2026, 9, 18, 11));
    expect(live.kind).toBe("intraday");
  });
});

describe("engines", () => {
  const w = windowOf(320, 11);
  const ref = w.bars[w.bars.length - 1].close;
  const session = { open: 0, close: 0, fraction: 1, hasGap: true, dateKey: "d" };
  const near = { entry: ref * 0.985, target: ref * 0.996, stop: ref * 0.98 }; // PLTR-like geometry

  it("bridge bars always contain their endpoints", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const a = Math.log(100),
        b = a + r.gaussian() * 0.01;
      const bar = bridgeBar(r, a, b, 1e-4);
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close) - 1e-9);
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close) + 1e-9);
    }
  });

  it("parametric Monte Carlo is reproducible and passes sanity checks", () => {
    const a = runParametricMc(w, near, { price: ref, gapScale: 1 }, [session], {
      paths: 4000,
      seed: "s",
    });
    const b = runParametricMc(w, near, { price: ref, gapScale: 1 }, [session], {
      paths: 4000,
      seed: "s",
    });
    expect(a.probabilities).toEqual(b.probabilities);
    expect(sanityCheck(a.probabilities, "mc")).toEqual([]);
    expect(a.probabilities.fill).toBeGreaterThan(0.2);
    expect(a.probabilities.fill).toBeLessThan(0.95);
  });

  it("bootstrap uses intraday blocks when available and passes sanity checks", () => {
    const o = runBootstrap(w, near, { price: ref, gapScale: 1 }, [session], {
      paths: 4000,
      seed: "s",
    });
    expect(o.details.mode).toBe("intraday-block");
    expect(sanityCheck(o.probabilities, "boot")).toEqual([]);
    const daily = runBootstrap(
      { ...w, intraday: null },
      near,
      { price: ref, gapScale: 1 },
      [session],
      { paths: 2000, seed: "s" },
    );
    expect(daily.details.mode).toBe("daily-bridge");
    expect(sanityCheck(daily.probabilities, "boot-daily")).toEqual([]);
  });

  it("analog engine selects similar sessions, replays intraday, and reports MFE/MAE", () => {
    const o = runAnalog(w, near, { price: ref, kind: "last-close", fraction: 1 }, 1, false, {
      k: 60,
    });
    expect(o.available).toBe(true);
    expect(o.details.selected).toBe(60);
    expect(o.details.pathResolution).toBe("intraday");
    expect(o.details.mfe.p50).toBeGreaterThan(0);
    expect(o.details.mae.p50).toBeLessThan(0);
    expect(o.details.mfe.p90).toBeGreaterThan(o.details.mfe.p50);
    expect(sanityCheck(o.probabilities, "analog")).toEqual([]);
    expect(o.details.targetRankInMfe).toBeGreaterThanOrEqual(0);
  });

  it("features are point-in-time (unchanged when future bars are appended)", () => {
    const f1 = featuresAsOf(w.bars, 200, w.bench)!;
    const f2 = featuresAsOf(w.bars.slice(0, 201), 200, w.bench.slice(0, 201))!;
    expect(f1).toEqual(f2);
    const ranked = rankAnalogs(f1, [
      { index: 1, f: f1 },
      { index: 2, f: { ...f1, rv20: f1.rv20 * 3 } },
    ]);
    expect(ranked[0].index).toBe(1);
    expect(ranked[0].similarity).toBeCloseTo(1);
  });

  it("a nearer level is touched more often (bootstrap and Monte Carlo agree on direction)", () => {
    const closeStop = { entry: ref, target: ref * 1.02, stop: ref * 0.997 };
    const mc = runParametricMc(w, closeStop, { price: ref, gapScale: 1 }, [session], {
      paths: 4000,
      seed: "d",
    }).probabilities;
    const bs = runBootstrap(w, closeStop, { price: ref, gapScale: 1 }, [session], {
      paths: 4000,
      seed: "d",
    }).probabilities;
    expect(mc.stopFirst).toBeGreaterThan(mc.targetFirst);
    expect(bs.stopFirst).toBeGreaterThan(bs.targetFirst);
  });

  it("combines engines convexly so identities survive", () => {
    const mc = runParametricMc(w, near, { price: ref, gapScale: 1 }, [session], {
      paths: 2000,
      seed: "c",
    });
    const an = runAnalog(w, near, { price: ref, kind: "last-close", fraction: 1 }, 1, false, {
      k: 40,
    });
    const bs = runBootstrap(w, near, { price: ref, gapScale: 1 }, [session], {
      paths: 2000,
      seed: "c",
    });
    const cmb = combineEngines([mc, an, bs], { "monte-carlo": 0.3, analog: 0.4, bootstrap: 0.3 });
    expect(sanityCheck(cmb.probabilities, "combined")).toEqual([]);
    expect(Object.values(cmb.weights).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1);
  });
});

describe("backtest", () => {
  it("walks forward without look-ahead and reports calibration metrics", () => {
    const w = windowOf(260, 5);
    const bt = runBacktest(w, { entry: 0.985, target: 0.996, stop: 0.98 }, 1, {
      dates: 25,
      paths: 400,
      seed: "bt",
    });
    expect(bt.dates).toBe(25);
    expect(bt.perEngine.combined.fill.n).toBe(25);
    expect(bt.perEngine["monte-carlo"].fill.brier).toBeGreaterThanOrEqual(0);
    expect(bt.perEngine["monte-carlo"].fill.brier).toBeLessThanOrEqual(1);
    expect(bt.weights).toBeNull(); // too few filled dates for unequal weights
    expect(bt.note).toMatch(/Only 25/);
  });
});

describe("end to end", () => {
  it("runs the PLTR-shaped setup with a reference above the entry and explains it", () => {
    const w = windowOf(320, 3, true, true);
    const ref = w.bars[w.bars.length - 1].close;
    const input = {
      ticker: "TEST",
      entry: ref * 0.985,
      target: ref * 0.9963,
      stop: ref * 0.9795,
      horizon: { type: "next" as const },
      shares: 100,
    };
    const r = runSimulation(input, w, {
      now: edt(2026, 9, 19, 12),
      paths: 3000,
      backtestDates: 12,
      backtestPaths: 300,
      dataSource: "synthetic",
      provider: "test",
      quoteAsOf: null,
      reference: { price: ref, asOf: 0, kind: "last-close", label: "test", gapScale: 1 },
    });
    expect(r.checks.passed).toBe(true);
    expect(r.combined.probabilities.fill).toBeGreaterThan(0);
    expect(r.combined.probabilities.fill).toBeLessThan(1);
    expect(r.engines.analog.available).toBe(true);
    expect(r.backtest?.dates).toBe(12);
    expect(r.ev.rewardToRisk).toBeCloseTo((0.9963 - 0.985) / (0.985 - 0.9795), 3);
    expect(r.provenance["Model version"]).toBe(r.modelVersion);
    const text = explainSimulation(r);
    expect(text.summary).toContain("fills in");
    expect(text.models).toMatch(/confidence/);
    expect(r.confidence.level).toMatch(/high|moderate|low/);
  });

  it("refuses invalid setups and too little history", () => {
    const w = windowOf(120, 1);
    expect(() =>
      runSimulation(
        { ticker: "T", entry: 100, target: 99, stop: 95, horizon: { type: "next" }, shares: null },
        w,
        {
          dataSource: "x",
          provider: "x",
          quoteAsOf: null,
          reference: { price: 100, asOf: 0, kind: "last-close", label: "", gapScale: 1 },
        },
      ),
    ).toThrow(/Target/);
  });
});
