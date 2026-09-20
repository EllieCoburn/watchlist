# Simulate: quantitative methodology (model version `first-passage-3-engine-2.0`)

This is the technical description of how the Simulate page turns a proposed trade into
probabilities. Every number on the page is produced by the code under `src/lib/quant/`;
the explanation text is generated from those numbers by fixed templates
(`explain.ts`) and cannot change them. See `SIMULATE_AUDIT.md` for the first-generation
model this replaces.

## 1. The question

Given a reference price R (last close, or a live price), a proposed entry E, target T,
stop S and a horizon of trading sessions: what is the probability that price trades at E
(the order fills), and, conditional on filling, how often is T touched before S, S before
T, neither by the end of the horizon, or both inside the same bar so that the order is
unknowable? This is a first-passage (barrier-hitting) problem, not a closing-price
forecast.

**Touch** (`path-eval.ts`): the target is touched when a bar's high ≥ T; the stop when a
bar's low ≤ S. Closes are irrelevant. **Fill**: E below R is a resting buy limit, filled
when a bar's low ≤ E (at E, or at the open when the open gaps through E); E above R is a
buy stop, filled when a bar's high ≥ E; E = R opens immediately. **Order inside the fill
bar** uses price continuity: a level on the far side of the entry must have been reached
after passing through the entry (known); a level on the near side may have traded before
the fill (ambiguous). **Both levels inside one bar after the fill** is ambiguous. Ambiguous
cases are reported as their own category and are never assigned an order.

## 2. Data (`src/app/api/simulate/route.ts`)

| Input | Source | Detail |
|---|---|---|
| Daily OHLC bars | `getDailyBars(ticker, 300)` via the provider facade: Finnhub candles (paid) → Polygon (`HISTORY_PROVIDER=polygon`) → Stooq → Yahoo; Alpaca on that provider | Up to 300 sessions (~14 months). Modeled bars are refused in production. |
| Intraday bars | `getIntradayHistory(ticker, 252, INTRADAY_INTERVAL_MINUTES)`: Polygon minute aggregates (paginated) or Alpaca | Regular hours only (09:30–16:00 ET); sessions with < 80% of expected bars are dropped (half days). Default interval 1 minute; 5 configurable. |
| Benchmark | `getDailyBars("QQQ", 300)` | Used for market-context features and correlation/beta. |
| Reference price | `getQuote(ticker)` + `reference.ts` | Weekend / pre-premarket: last close. Live extended-hours print (quote timestamp after the close and within 6 hours of now): that price, with the residual gap to the open modeled at half strength. During the session: current price, no gap. |
| Earnings | `getNextEarningsDate` (Finnhub calendar) | Event warning only; never enters the math. |

Nothing is ever substituted with modeled data in production; the API answers
"Unable to calculate probability because required market data is unavailable." Intraday
data missing is reported and the engines fall back to daily bars with all same-session
"both" cases marked ambiguous.

## 3. Statistics (`stats.ts`, `engine.ts` → `computeStats`)

From daily bars, per session t with previous close C₋₁: daily log return
r_t = ln(C_t / C_{t−1}); gap g_t = ln(O_t / C_{t−1}); intraday i_t = ln(C_t / O_t); range
(H_t − L_t)/O_t; true range max(H−L, |H−C₋₁|, |L−C₋₁|)/C₋₁.

- Close-to-close volatility: sample standard deviation of r over 20, 60, 252 sessions.
- EWMA volatility: σ² = Σ λ^k r²_{t−k} / Σ λ^k, λ = 0.94 (RiskMetrics).
- Realized intraday volatility (20 sessions): sqrt of mean Σ (1-minute log returns)².
- ATR(14): mean true range over 14 sessions. Average range (20): mean (H−L)/O.
- Volatility regime: percentile of the current 20-day σ among rolling 20-day σ over the past year (low < 25th, normal, elevated > 75th, extreme > 90th).
- Skewness, excess kurtosis (252 sessions), lag-1 autocorrelation (60).
- Gap statistics over 60 sessions: mean |g|, σ_g, count of |g| > 2%, max |g|, last gap.
- Benchmark: QQQ last return, 5-day momentum, 20-day σ, 60-day correlation and beta.

These are distinct quantities and are labeled as such in the UI. The range is never used as a standard deviation.

## 4. Horizon (`calendar.ts`)

Sessions come from the US trading calendar with weekends and the exchange holiday list.
"Today" while open = the remaining fraction of the current session, no gap. "Today" while
closed = the next session with its gap (stated on the page). "Next trading day" = the next
full session with its gap. Custom N = N sessions (today's remainder counts as the first
when the market is open).

## 5. Engine A: parametric Monte Carlo (`engine-mc.ts`)

Model: d ln S = σ dW with μ = 0. Drift is deliberately zero: over one to a few sessions
the daily mean return (~0.05%) is an order of magnitude below σ (~2–4%), and estimates of
it from short windows are noise. Innovations are Student-t with ν = 4 + 6/κ (κ = excess
kurtosis, ν clamped to [3, 30]) standardized to unit variance, sampled with the
Marsaglia–Tsang gamma method.

Volatility: σ_daily = EWMA σ. Overnight/intraday split: share s = var(g)/(var(g)+var(i))
over 60 sessions (clamped 5–70%); σ_gap = σ√s, σ_intra = σ√(1−s). The intraday variance is
spread over 78 five-minute steps with the stock's own realized profile (mean squared
1-minute returns aggregated into 78 slots over the last 60 sessions, shrunk 30% toward
flat), so the U-shape of intraday volatility is respected. For multi-session horizons
σ² is updated per simulated session as σ² ← λσ² + (1−λ)r², λ = 0.94 (volatility
clustering).

Each step from log price a to b with variance v produces a bar whose high and low are
drawn from the exact Brownian-bridge extreme distributions:
M = (a + b + √((b−a)² − 2v ln U))/2, m = (a + b − √((b−a)² − 2v ln U′))/2. The bars are
judged by `evaluatePath`. If both levels fall inside one step, that step is re-drawn as 10
sub-steps from the bridge conditioned on its endpoints (the model's exact conditional
law), up to two rounds (0.5-second-scale resolution), and only if still unresolved is the
path counted as ambiguous. Paths: 100,000 (50,000 for horizons over 10 sessions). Seeded
xoshiro128** generator; the seed is stored with the run.

## 6. Engine B: historical analogs (`features.ts`, `engine-analog.ts`)

For each candidate past session j, features are computed **as of the close of j** using
only bars[0..j]: 5/10/20-day momentum, 20-day σ, ATR(14), log volume ratio to the 20-day
mean, that day's gap, return, range and close location within the range, distance to the
20-day high and low and to the 50-day average, the volatility-regime percentile, and
benchmark context (QQQ last return, 5-day momentum, 20-day σ, 60-day correlation and
beta). Today's query vector is computed the same way from the last bar.

Distance = weighted standardized Euclidean distance (weights in `FEATURE_WEIGHTS`, heaviest
on 20-day σ, the prior day's return, gap, range and close location, and regime); the
scale of each feature is its standard deviation across the candidates. Similarity =
exp(−d²/2). The K nearest sessions are selected, K = min(80, max(30, candidates/4)).
Effective sample size = (Σw)²/Σw². Fewer than 30 selected or ESS < 20 is reported as
insufficient and the engine's weight is halved.

Each analog's **actual** next session(s) are replayed at intraday resolution: its prior
close plays the role of R, and E, T, S are applied as the same percentages of that close.
`evaluatePath` decides fill, touches and order on the real bars (ambiguous when both
levels fall in one bar). Probabilities are similarity-weighted frequencies. MFE = max
high / prior close − 1 and MAE = min low / prior close − 1 over the horizon give the
excursion distributions (weighted 25/50/75/90th percentiles) and the target's and stop's
percentile rank within them.

## 7. Engine C: historical bootstrap (`engine-bootstrap.ts`)

With intraday data: a block bootstrap of the stock's own bars. Pool = last 120 sessions
with exponential recency weights (half-life 40). Each simulated session: (1) an overnight
gap resampled from sessions whose trailing 20-day σ was within 0.6–1.6× today's (all
sessions if fewer than 20 qualify), (2) one-hour blocks of consecutive real bars copied
from a randomly chosen pool session at the same time of day, each bar carrying its real
open/high/low/close ratios to the previous close. Log moves are scaled by
ρ = σ_EWMA / σ_pool (clamped 0.5–2). Fat tails, skew, jumps and intraday seasonality are
therefore the stock's own. Paths: 100,000 with 5-minute bars, 50,000 with 1-minute bars.

Without intraday data: (gap, intraday) daily pairs are resampled with recency weights and
the session is filled with a Brownian bridge whose volatility is calibrated by bisection to
reproduce the stock's mean daily range; bar extremes are sampled from the bridge. Labeled
on the page as such.

## 8. Combination (`combine.ts`) and checks (`checks.ts`)

The combined estimate is a convex combination of the available engines, field by field,
so every identity is preserved. Weights come from the backtest (inverse Brier score of
each engine's P(target first | fill), when at least 30 filled unambiguous backtest dates
exist); otherwise equal. An engine with a stated data limitation (thin analog sample,
daily-only bootstrap) is halved. Automated checks on every engine and the combination:
each probability in [0,1]; target-first + stop-first + neither + ambiguous = 1;
P(target) + P(stop) − P(both) + P(neither) = 1; P(both) ≤ min(P(target), P(stop));
P(first) ≤ P(touched). A failing result is never returned.

## 9. Walk-forward backtest (`backtest.ts`)

For the last 50 sessions d (training ≥ 120 sessions): the window is sliced to bars ≤ d−1,
intraday sessions ≤ d−1 and benchmark ≤ d−1 (`sliceWindow`), the reference is the close of
d−1, and E, T, S are applied as today's percentages of that reference. Each engine
predicts (1,500 paths for the simulation engines; analogs with K = 60) and the actual
sessions d..d+h−1 are evaluated with the same `evaluatePath`. Two binary events are
scored: fill, and target-first-given-fill (ambiguous actuals excluded). Metrics: Brier
score, log loss, expected calibration error over ten reliability buckets. The equal-weight
combination is scored too. No future bar, feature, benchmark value or earnings date can
enter a prediction because the sliced window does not contain them.

## 10. Expected value (`engine.ts`)

EV | fill = P(target first)·(T − E) − P(stop first)·(E − S) + P(neither)·E[exit − E],
where exit is the last simulated close of the horizon (market-on-close exit) and ambiguous
paths are split between target-first and stop-first in the ratio of decided cases. EV
overall = P(fill) × EV | fill. With shares: capital, target profit, stop loss, EV if
filled, EV overall. The page states that EV is a statistical average across modeled
outcomes, not a prediction of realized profit. Fills at the open through a gap are better
than E in the paths but EV uses E as the assumed fill price (conservative).

## 11. Confidence (`confidence.ts`)

A score from measurable items: analog sample size and ESS, disagreement between engines
(range of target-first), backtest calibration error and sample, intraday data
availability, history length, regime, scheduled events (earnings via provider, FOMC
decision dates from a static 2026 list to be verified), an unusual last session (|z| > 2.5)
or large last gap, gap frequency, stale bars, and reference type. Levels: high only with no
warnings and a positive score; moderate; low.

## 12. Known limitations

- Intraday history depends on the history provider. Finnhub's free plan has none; Polygon's free plan provides finished sessions (no same-day bars) at 5 requests/minute, so the first run for a ticker can take a minute of API budget and is then cached for 12 hours.
- Premarket high/low/volume and index futures are not available on the current providers; a live extended-hours print is used as the reference, and the residual gap is modeled at half strength (an assumption).
- VIX is unavailable on the free plans; QQQ realized volatility stands in as the market-volatility regime.
- Earnings, news and halts are not modeled; the page warns when earnings or an FOMC decision fall inside the horizon.
- Slippage, spreads, partial fills and fees are not modeled; fills occur exactly at the level.
- The parametric engine's intraday path is a Brownian bridge with a Student-t daily innovation; real intraday paths cluster and jump more.
- Backtest sample is 50 dates for one setup shape; calibration figures are indicative, and the page says so when n < 30.
- The daily-only fallback for the bootstrap and analogs cannot observe intrabar order.
