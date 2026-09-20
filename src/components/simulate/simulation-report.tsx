import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/finance/money";
import type { SimulateResponse } from "@/app/api/simulate/route";
import type { EngineOutput } from "@/lib/quant/engine-mc";
import { cn } from "@/lib/utils";
import { FirstLevelReached, TouchProbabilities } from "./probability-bars";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const pct1 = (p: number) => `${(p * 100).toFixed(2)}%`;
const pctPt = (p: number) => `${(p * 100).toFixed(1)} pts`;

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8",
        className,
      )}
      aria-label={title}
    >
      <p className="label-caps text-muted">{title}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  small?: boolean;
}) {
  return (
    <div>
      <dt className="label-caps text-muted">{label}</dt>
      <dd
        className={cn("tabular mt-1.5 font-mono text-ink", small ? "text-base" : "text-xl", tone)}
      >
        {value}
      </dd>
    </div>
  );
}

function EngineRow({ e }: { e: EngineOutput }) {
  const p = e.probabilities;
  const cell = (v: number, tone?: string) => (
    <td className={cn("tabular px-3 py-2.5 text-right font-mono", tone)}>
      {e.available ? pct(v) : "—"}
    </td>
  );
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5 text-sm text-ink">
        {e.label}
        <span className="block text-xs text-muted">
          {e.available
            ? `${e.sampleSize.toLocaleString("en-US")} ${e.name === "analog" ? "sessions" : "paths"}`
            : e.reason}
          {e.available && e.reason ? ` · ${e.reason}` : ""}
        </span>
      </td>
      {cell(p.fill)}
      {cell(p.targetFirst, "text-gain-text")}
      {cell(p.stopFirst, "text-loss-text")}
      {cell(p.neither)}
      {cell(p.ambiguous, "text-muted")}
    </tr>
  );
}

export function SimulationReport({ data }: { data: SimulateResponse }) {
  const r = data.result;
  const cp = r.combined.probabilities;
  const b = r.barriers;
  const e = r.ev;
  const c = r.confidence;
  const a = r.engines.analog;
  const bt = r.backtest;
  const evTone =
    e.evPerShareIfFilled > 0
      ? "text-gain-text"
      : e.evPerShareIfFilled < 0
        ? "text-loss-text"
        : "text-ink";
  const immediate = Math.abs(r.levelsRelative.entry - 1) < 1e-6 || r.reference.kind === "intraday";

  return (
    <div className="space-y-6">
      {data.devModeledData ? (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-loss-text bg-loss-soft px-4 py-3 text-sm text-loss-text"
        >
          Development only: this run used modeled price history because no live provider is
          configured. Production refuses to simulate without real market data.
        </p>
      ) : null}
      {data.dataNotes.map((n, i) => (
        <p
          key={i}
          role="status"
          className="rounded-[var(--radius-sm)] border border-border bg-surface-muted px-4 py-3 text-sm text-ink-secondary"
        >
          {n}
        </p>
      ))}

      <header className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
        <p className="label-caps text-muted">Trade simulation · {r.horizon.label}</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <div>
            <p className="font-mono text-2xl font-semibold tracking-[0.04em] text-ink">
              {r.input.ticker}
            </p>
            <p className="mt-1 font-mono text-sm text-muted">
              Reference {formatMoney(r.reference.price)} · {r.reference.label}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="label-caps text-muted">Entry</dt>
              <dd className="tabular mt-1 font-mono text-2xl text-ink">
                {formatMoney(r.input.entry)}
              </dd>
              <dd className="tabular font-mono text-sm text-muted">
                {formatSignedPercent((r.levelsRelative.entry - 1) * 100)} from reference
              </dd>
            </div>
            <div>
              <dt className="label-caps text-gain-text">Target</dt>
              <dd className="tabular mt-1 font-mono text-2xl text-ink">
                {formatMoney(r.input.target)}
              </dd>
              <dd className="tabular font-mono text-sm text-gain-text">
                {formatSignedMoney(b.target.dollars)} ({formatSignedPercent(b.target.percent * 100)}
                )
              </dd>
            </div>
            <div>
              <dt className="label-caps text-loss-text">Stop</dt>
              <dd className="tabular mt-1 font-mono text-2xl text-ink">
                {formatMoney(r.input.stop)}
              </dd>
              <dd className="tabular font-mono text-sm text-loss-text">
                {formatSignedMoney(b.stop.dollars)} ({formatSignedPercent(b.stop.percent * 100)})
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <Card title="Entry probability">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="tabular font-mono text-5xl leading-none text-ink">{pct(cp.fill)}</p>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            {immediate
              ? "The entry equals the reference price, so the position opens immediately; everything below applies from that moment."
              : `Probability that ${r.input.ticker} trades at ${formatMoney(r.input.entry)} during ${r.horizon.label}, so a resting order at that price would fill. Paths that never reach the entry are counted as no fill and are excluded from everything below.`}
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="label-caps text-muted">If the entry fills · combined estimate</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <TouchProbabilities
            target={r.input.target}
            stop={r.input.stop}
            pTarget={cp.targetTouched}
            pStop={cp.stopTouched}
            paths={r.engines.monteCarlo.sampleSize}
          />
          <FirstLevelReached
            targetFirst={cp.targetFirst}
            stopFirst={cp.stopFirst}
            neither={cp.neither}
            both={cp.both}
            ambiguous={cp.ambiguous}
          />
        </div>
      </div>

      <Card title="Model comparison">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="px-3 py-2 font-normal">Model</th>
                <th className="px-3 py-2 text-right font-normal">Entry fills</th>
                <th className="px-3 py-2 text-right font-normal">Target first</th>
                <th className="px-3 py-2 text-right font-normal">Stop first</th>
                <th className="px-3 py-2 text-right font-normal">Neither</th>
                <th className="px-3 py-2 text-right font-normal">Ambiguous</th>
              </tr>
            </thead>
            <tbody>
              <EngineRow e={r.engines.monteCarlo} />
              <EngineRow e={r.engines.analog} />
              <EngineRow e={r.engines.bootstrap} />
              <tr className="border-t-2 border-ink">
                <td className="px-3 py-2.5 text-sm font-medium text-ink">
                  Combined
                  <span className="block text-xs font-normal text-muted">
                    weights{" "}
                    {Object.entries(r.combined.weights)
                      .map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)}%`)
                      .join(" · ")}
                  </span>
                </td>
                <td className="tabular px-3 py-2.5 text-right font-mono font-medium">
                  {pct(cp.fill)}
                </td>
                <td className="tabular px-3 py-2.5 text-right font-mono font-medium text-gain-text">
                  {pct(cp.targetFirst)}
                </td>
                <td className="tabular px-3 py-2.5 text-right font-mono font-medium text-loss-text">
                  {pct(cp.stopFirst)}
                </td>
                <td className="tabular px-3 py-2.5 text-right font-mono font-medium">
                  {pct(cp.neither)}
                </td>
                <td className="tabular px-3 py-2.5 text-right font-mono text-muted">
                  {pct(cp.ambiguous)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Conditional on the entry filling. Weighting: {r.combined.method}. Disagreement between
          models on target-first: {pctPt(r.combined.disagreement)}. Ambiguous means both levels
          traded inside one 5-minute bar, so the order is unknown and is not guessed.
        </p>
      </Card>

      <Card title="Historical evidence">
        {a.available ? (
          <>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {a.details.selected} comparable sessions selected from {a.details.candidates}{" "}
              candidates by similarity of momentum, volatility, ATR, volume, the prior day’s return,
              range and close location, distance to recent highs/lows and the 50-day average,
              volatility regime{a.details.benchmark ? `, and ${a.details.benchmark} context` : ""}.
              Effective sample size {a.details.effectiveSampleSize.toFixed(0)}. Paths replayed at{" "}
              {a.details.pathResolution === "intraday" ? "5-minute" : "daily"} resolution (
              {Math.round(a.details.intradayCoverage * 100)}% intraday coverage). Excursions are
              measured from each analog’s prior close.
              {!a.details.sufficient
                ? " This is a thin sample; the analog estimate carries half weight."
                : ""}
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <p className="label-caps text-gain-text">Maximum favorable excursion</p>
                <dl className="mt-3 grid grid-cols-4 gap-3">
                  <Stat label="Median" value={formatSignedPercent(a.details.mfe.p50 * 100)} small />
                  <Stat label="75th" value={formatSignedPercent(a.details.mfe.p75 * 100)} small />
                  <Stat label="90th" value={formatSignedPercent(a.details.mfe.p90 * 100)} small />
                  <Stat
                    label="Target rank"
                    value={`${Math.round((b.target.historicalPercentile ?? 0) * 100)}th`}
                    small
                  />
                </dl>
              </div>
              <div>
                <p className="label-caps text-loss-text">Maximum adverse excursion</p>
                <dl className="mt-3 grid grid-cols-4 gap-3">
                  <Stat label="Median" value={formatSignedPercent(a.details.mae.p50 * 100)} small />
                  <Stat label="75th" value={formatSignedPercent(a.details.mae.p75 * 100)} small />
                  <Stat label="90th" value={formatSignedPercent(a.details.mae.p90 * 100)} small />
                  <Stat
                    label="Stop rank"
                    value={`${Math.round((b.stop.historicalPercentile ?? 0) * 100)}th`}
                    small
                  />
                </dl>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-loss-text">{a.reason}</p>
        )}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="px-3 py-2 font-normal">Level</th>
                <th className="px-3 py-2 text-right font-normal">Distance</th>
                <th className="px-3 py-2 text-right font-normal">ATR ×</th>
                <th className="px-3 py-2 text-right font-normal">Avg range ×</th>
                <th className="px-3 py-2 text-right font-normal">σ</th>
                <th className="px-3 py-2 text-right font-normal">Historical rank</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                { name: "Target", d: b.target, tone: "text-gain-text" },
                { name: "Stop", d: b.stop, tone: "text-loss-text" },
              ].map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className={cn("px-3 py-2.5 font-sans", row.tone)}>{row.name}</td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {formatSignedMoney(row.d.dollars)} · {formatSignedPercent(row.d.percent * 100)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{row.d.atrMultiple.toFixed(2)}</td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {row.d.rangeMultiple.toFixed(2)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {row.d.sigmaMultiple.toFixed(2)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {row.d.historicalPercentile == null
                      ? "—"
                      : `${Math.round(row.d.historicalPercentile * 100)}th`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="ATR (14)" value={pct1(r.stats.atr14)} small />
          <Stat label="Avg range (20)" value={pct1(r.stats.averageRange20)} small />
          <Stat label="EWMA vol" value={pct1(r.stats.volatility.ewma)} small />
          <Stat
            label="20 / 60 / 252d"
            value={`${pct1(r.stats.volatility.closeToClose20)} / ${pct1(r.stats.volatility.closeToClose60)} / ${pct1(r.stats.volatility.closeToClose252)}`}
            small
          />
          <Stat
            label="Intraday vol (20)"
            value={
              r.stats.volatility.realizedIntraday20 == null
                ? "—"
                : pct1(r.stats.volatility.realizedIntraday20)
            }
            small
          />
          <Stat
            label="Regime"
            value={<span className="capitalize">{r.stats.regime.regime}</span>}
            small
          />
        </dl>
        {r.stats.benchmark ? (
          <p className="mt-4 text-sm text-muted">
            Market: {r.stats.benchmark.symbol} {formatSignedPercent(r.stats.benchmark.ret1 * 100)}{" "}
            last session, {formatSignedPercent(r.stats.benchmark.mom5 * 100)} over 5; 60-day
            correlation {r.stats.benchmark.corr60.toFixed(2)}, beta{" "}
            {r.stats.benchmark.beta60.toFixed(2)}.
          </p>
        ) : null}
      </Card>

      <Card title="Risk, reward and expected value">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Gain / share"
            value={formatSignedMoney(e.gainPerShare)}
            tone="text-gain-text"
          />
          <Stat
            label="Loss / share"
            value={formatSignedMoney(-e.lossPerShare)}
            tone="text-loss-text"
          />
          <Stat label="Reward / risk" value={e.rewardToRisk.toFixed(2)} />
          <Stat
            label="EV / share if filled"
            value={formatSignedMoney(e.evPerShareIfFilled)}
            tone={evTone}
          />
          <Stat label="EV / share" value={formatSignedMoney(e.evPerShare)} tone={evTone} />
          {e.shares != null ? (
            <Stat
              label="Shares"
              value={e.shares.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            />
          ) : null}
          {e.capital != null ? <Stat label="Capital" value={formatMoney(e.capital)} /> : null}
          {e.targetProfit != null ? (
            <Stat
              label="At target"
              value={formatSignedMoney(e.targetProfit)}
              tone="text-gain-text"
            />
          ) : null}
          {e.stopLoss != null ? (
            <Stat label="At stop" value={formatSignedMoney(e.stopLoss)} tone="text-loss-text" />
          ) : null}
          {e.expectedValueIfFilled != null ? (
            <Stat
              label="EV if filled"
              value={formatSignedMoney(e.expectedValueIfFilled)}
              tone={evTone}
            />
          ) : null}
          {e.expectedValue != null ? (
            <Stat label="EV overall" value={formatSignedMoney(e.expectedValue)} tone={evTone} />
          ) : null}
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          EV if filled = P(target first) × gain − P(stop first) × loss + P(neither) × average
          end-of-horizon result. {e.neitherHandling} {e.ambiguousHandling} EV overall multiplies by
          the fill probability. Expected value is a statistical average across modeled outcomes, not
          a prediction of realized profit.
        </p>
      </Card>

      <Card title={`Model confidence · ${c.level}`}>
        {c.warnings.length > 0 ? (
          <ul className="space-y-2" role="list">
            {c.warnings.map((w, i) => (
              <li
                key={i}
                role="alert"
                className="rounded-[var(--radius-sm)] border border-loss/40 bg-loss-soft px-3.5 py-2.5 text-sm leading-relaxed text-loss-text"
              >
                {w}
              </li>
            ))}
          </ul>
        ) : null}
        {c.reasons.length > 0 ? (
          <ul
            className={cn(
              "space-y-1.5 text-sm leading-relaxed text-ink-secondary",
              c.warnings.length > 0 && "mt-5",
            )}
            role="list"
          >
            {c.reasons.map((n, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-faint" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {bt ? (
        <Card
          title={`Walk-forward backtest · ${bt.dates} dates (${bt.firstDate} → ${bt.lastDate})`}
        >
          <p className="text-sm leading-relaxed text-ink-secondary">
            For each past date the engines saw only data before it, predicted this setup as
            percentages of that day’s reference price, and were scored against what happened.
            {bt.filledDates} of {bt.dates} dates filled; {bt.ambiguousDates} had an unorderable
            first touch and were excluded from target-first scoring. {bt.weightMethod}.
            {bt.note ? ` ${bt.note}` : ""}
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="label-caps text-left text-muted">
                  <th className="px-3 py-2 font-normal">Model</th>
                  <th className="px-3 py-2 text-right font-normal">Fill Brier</th>
                  <th className="px-3 py-2 text-right font-normal">Target-first Brier</th>
                  <th className="px-3 py-2 text-right font-normal">Log loss</th>
                  <th className="px-3 py-2 text-right font-normal">Calibration error</th>
                  <th className="px-3 py-2 text-right font-normal">n</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(["monte-carlo", "analog", "bootstrap", "combined"] as const).map((k) => {
                  const m = bt.perEngine[k];
                  const f = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "—");
                  return (
                    <tr
                      key={k}
                      className={cn("border-t border-border", k === "combined" && "font-medium")}
                    >
                      <td className="px-3 py-2 font-sans">{k}</td>
                      <td className="tabular px-3 py-2 text-right">{f(m.fill.brier)}</td>
                      <td className="tabular px-3 py-2 text-right">{f(m.targetFirst.brier)}</td>
                      <td className="tabular px-3 py-2 text-right">{f(m.targetFirst.logLoss)}</td>
                      <td className="tabular px-3 py-2 text-right">
                        {Number.isFinite(m.targetFirst.ece) ? pctPt(m.targetFirst.ece) : "—"}
                      </td>
                      <td className="tabular px-3 py-2 text-right">{m.targetFirst.n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {bt.perEngine.combined.targetFirst.buckets.some((k) => k.n > 0) ? (
            <div className="mt-5">
              <p className="label-caps text-muted">Reliability · combined P(target first | fill)</p>
              <table className="mt-2 w-full max-w-md font-mono text-xs">
                <thead>
                  <tr className="label-caps text-left text-muted">
                    <th className="py-1 font-normal">Predicted</th>
                    <th className="py-1 text-right font-normal">Observed</th>
                    <th className="py-1 text-right font-normal">n</th>
                  </tr>
                </thead>
                <tbody>
                  {bt.perEngine.combined.targetFirst.buckets
                    .filter((k) => k.n > 0)
                    .map((k) => (
                      <tr key={k.lo} className="border-t border-border">
                        <td className="tabular py-1">
                          {pct(k.lo)}–{pct(k.hi)} (avg {pct(k.predicted)})
                        </td>
                        <td className="tabular py-1 text-right">{pct(k.observed)}</td>
                        <td className="tabular py-1 text-right">{k.n}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card title="Walk-forward backtest">
          <p className="text-sm text-muted">Not run: fewer than 150 sessions of history.</p>
        </Card>
      )}

      <Card title="Explain this">
        <p className="text-[0.9375rem] leading-relaxed text-ink">{data.explanation.summary}</p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink">{data.explanation.models}</p>
        <p className="label-caps mt-6 text-muted">What drove this result</p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-secondary" role="list">
          {data.explanation.drivers.map((d, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-faint" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-muted">{data.explanation.caveat}</p>
      </Card>

      <details className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
        <summary className="label-caps cursor-pointer text-muted">How this was calculated</summary>
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {Object.entries(r.provenance).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[10rem_1fr] gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-xs break-all text-ink">{v ?? "—"}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <dt className="text-muted">Run</dt>
            <dd className="font-mono text-xs text-ink">
              {data.runId ?? "not stored"} · {r.computeMs} ms · checks{" "}
              {r.checks.passed ? "passed" : "FAILED"}
            </dd>
          </div>
        </dl>
        {a.available && a.details.top.length ? (
          <div className="mt-5">
            <p className="label-caps text-muted">Closest analog sessions</p>
            <table className="mt-2 w-full max-w-lg font-mono text-xs">
              <thead>
                <tr className="label-caps text-left text-muted">
                  <th className="py-1 font-normal">Session</th>
                  <th className="py-1 text-right font-normal">Similarity</th>
                  <th className="py-1 text-right font-normal">MFE</th>
                  <th className="py-1 text-right font-normal">MAE</th>
                  <th className="py-1 text-right font-normal">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {a.details.top.map((t) => (
                  <tr key={t.date} className="border-t border-border">
                    <td className="py-1">{t.date}</td>
                    <td className="tabular py-1 text-right">{t.similarity.toFixed(2)}</td>
                    <td className="tabular py-1 text-right text-gain-text">
                      {formatSignedPercent(t.mfe * 100)}
                    </td>
                    <td className="tabular py-1 text-right text-loss-text">
                      {formatSignedPercent(t.mae * 100)}
                    </td>
                    <td className="py-1 text-right">{t.first}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </details>
    </div>
  );
}
