# Simulate: audit of the first-generation model (as shipped in commit 38b08ef)

This documents exactly how the first version computed its numbers, traced through the code,
before any of it was changed. The PLTR example (entry 175, target 177, stop 174, next
session) is used throughout. The figures quoted from the UI (target touched ≈ 69%, stop
touched ≈ 80%, target first ≈ 39%, stop first ≈ 61%, both ≈ 49%, neither ≈ 0%, average
daily range 4.04%, daily volatility 3.84%, median up +1.48%, median down −2.01%) are
consistent with this implementation; nothing below is inferred from the numbers alone.

## Data

| Question | Answer (v1) |
|---|---|
| Historical data | Daily OHLC bars from the provider facade `getDailyBars(ticker, 260)`. With Finnhub: Finnhub candles (paid), else Polygon, else Stooq, else Yahoo. |
| Date range | The most recent 260 completed sessions available from the source (roughly one calendar year). |
| Granularity | Daily only. No intraday data was used anywhere. |
| Observations | 259 return samples from 260 bars (first bar has no previous close). `stats.observations` in the report. |

## Formulas (v1)

- **Average daily range** = mean over the last 20 sessions of `(high − low) / open` (`stats.ts` `range`, averaged in `engine.ts` as `averageRange`). This is a range, not a standard deviation.
- **Daily volatility** = exponentially weighted standard deviation of close-to-close log returns, λ = 0.94, most recent observation weighted 1 (`ewmaVolatility`). This is the number shown as "daily volatility" and used as σ in the barrier "sigma multiples".
- **Drift** = none imposed. The empirical mean of the resampled window enters implicitly through the bootstrap.
- **Volatility regime** = `regimeScale = clamp(ewma / std(last 252 daily log returns), 0.4, 2.5)`. Every drawn historical return was multiplied by this ratio.
- **Median up / down from open** = medians over comparable sessions of `ln(high/open)` and `ln(open/low)` (converted back to percentages) from the empirical module; these were the "excursions".

## Simulation (v1)

- **Distribution sampled**: not a parametric distribution. Each simulated session drew one real historical session (index sampled by a Walker alias table with exponential recency weights, half-life 60 sessions) and took that session's real `(gap, intraday)` log-return pair, scaled by `regimeScale`. Fat tails and skew were therefore the stock's own.
- **Intraday path**: a Brownian bridge from the session open to the drawn close in 26 steps (15-minute resolution), with bridge volatility found by bisection so that the mean simulated `(high − low)` matched the historical mean range × `regimeScale`. Between steps the exact bridge crossing probability `exp(−2·d1·d2 / stepVariance)` decided whether a barrier was touched without the step endpoint crossing it.
- **Time steps per session**: 26.
- **Overnight gaps**: yes for "next session" and multi-day horizons: the drawn session's real `ln(open / previous close)` was applied first, and a gap through a barrier counted as a touch at the open. Not applied for "today" intraday starts.
- **Starting price**: **every path began at the entry price ($175)**, not at the actual reference price ($177.64). This is the main defect the user identified: it answers "what happens to a position that already exists at $175" and ignores whether $175 is ever reached.
- **First touch**: the first step (or between-step crossing) at which the log price reached the target or the stop. If both were detected within the same step the barrier nearer to the step's starting price was declared first (a heuristic, not marked ambiguous).
- **Neither ≈ 0%**: with a stop only 0.57% below entry (≈ 0.14 × the 4.04% average range) and a target 1.14% above, almost every simulated session touches at least one level. Neither = 1 − P(target first) − P(stop first) = 1 − 0.39 − 0.61 ≈ 0.
- **Touch probabilities exceeding 100%**: touches are not exclusive. P(target touched) + P(stop touched) − P(both) = 1 − P(neither): 69 + 80 − 49 = 100. Verified by construction: each path increments `targetTouched` and `stopTouched` independently, `both` when it touched the second barrier after the first, and the identity holds exactly in `runMonteCarlo`.
- **Both touched**: after the first touch the path kept running and the other barrier was checked step by step (including the bridge correction) for the rest of the horizon; `both` counts those paths. It is bounded by both touch counts by construction.

## Empirical analysis (v1)

For each historical window of the horizon length, the reference was the previous close (or the open for intraday starts). Target hit if `max high / reference − 1 ≥ +1.14%`, stop hit if `min low / reference − 1 ≤ −0.57%`. When both were hit inside the **same daily bar** the order was **inferred** from the bar's direction (a down day was assumed to visit its high first). The report disclosed the share of inferred orders, but this is the OHLC sequencing problem the user correctly flags: daily bars cannot establish which level traded first, and inference is not evidence.

## Other v1 properties

- Only one model; no disagreement was visible.
- No market context (QQQ / SPY) was used.
- No backtest; "Model confidence" was a rule-based flag set, not a calibration measurement.
- Sanity identities held by construction but were not asserted.
- Expected value combined P(target first) × gain − P(stop first) × loss with the mean mark-to-market of "neither" paths at horizon end.
