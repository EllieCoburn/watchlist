import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/finance/money";
import type { SimulateResponse } from "@/app/api/simulate/route";
import { cn } from "@/lib/utils";
import { FirstLevelReached, TouchProbabilities } from "./probability-bars";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const pct1 = (p: number) => `${(p * 100).toFixed(2)}%`;

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

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div>
      <dt className="label-caps text-muted">{label}</dt>
      <dd className={cn("tabular mt-1.5 font-mono text-xl text-ink", tone)}>{value}</dd>
    </div>
  );
}

export function SimulationReport({ data }: { data: SimulateResponse }) {
  const r = data.result;
  const p = r.monteCarlo.probabilities;
  const b = r.barriers;
  const e = r.ev;
  const c = r.confidence;
  const emp = r.empirical;
  const evTone =
    e.evPerShare > 0 ? "text-gain-text" : e.evPerShare < 0 ? "text-loss-text" : "text-ink";

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

      <header className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
        <p className="label-caps text-muted">Trade simulation · {r.horizon.label}</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-4">
          <div>
            <p className="font-mono text-2xl font-semibold tracking-[0.04em] text-ink">
              {r.input.ticker}
            </p>
            <p className="mt-1 font-mono text-sm text-muted">Entry {formatMoney(r.input.entry)}</p>
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <TouchProbabilities
          target={r.input.target}
          stop={r.input.stop}
          pTarget={p.targetTouched}
          pStop={p.stopTouched}
          paths={r.monteCarlo.paths}
        />
        <FirstLevelReached
          targetFirst={p.targetFirst}
          stopFirst={p.stopFirst}
          neither={p.neither}
          both={p.both}
        />
      </div>

      <Card title="Distance to each level">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 text-sm leading-relaxed text-ink">
            <p>
              Your <span className="font-mono">{formatMoney(r.input.target)}</span> target is{" "}
              <span className="font-mono font-semibold">{b.target.rangeMultiple.toFixed(2)}×</span>{" "}
              the stock’s recent average daily range and{" "}
              <span className="font-mono font-semibold">{b.target.sigmaMultiple.toFixed(2)}</span>{" "}
              daily standard deviations away.
            </p>
            <p>
              Your <span className="font-mono">{formatMoney(r.input.stop)}</span> stop is{" "}
              <span className="font-mono font-semibold">{b.stop.rangeMultiple.toFixed(2)}×</span>{" "}
              the average daily range and{" "}
              <span className="font-mono font-semibold">{b.stop.sigmaMultiple.toFixed(2)}</span>{" "}
              standard deviations away.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Avg daily range" value={pct1(b.averageDailyRangePct)} />
            <Stat label="Daily volatility" value={pct1(b.dailySigmaPct)} />
            <Stat
              label="Median up from open"
              value={formatSignedPercent(b.medianUpExcursionPct * 100)}
              tone="text-gain-text"
            />
            <Stat
              label="Median down from open"
              value={formatSignedPercent(-b.medianDownExcursionPct * 100)}
              tone="text-loss-text"
            />
          </dl>
        </div>
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
          {e.expectedProfit != null ? (
            <Stat
              label="Expected value"
              value={formatSignedMoney(e.expectedProfit)}
              tone={evTone}
            />
          ) : null}
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Expected value is the probability-weighted average outcome across all simulated paths:{" "}
          {pct(p.targetFirst)} × gain − {pct(p.stopFirst)} × loss, plus the average mark-to-market
          of the {pct(p.neither)} of paths that touched neither level (
          {formatSignedMoney(e.evPerShareBarriersOnly)} per share from the barriers alone). It is
          not an expected profit on this trade. A positive expected value does not make any single
          trade profitable; it describes the average over many repetitions of the same setup under
          this model.
        </p>
      </Card>

      <Card title="In plain English">
        <p className="text-[0.9375rem] leading-relaxed text-ink">{data.explanation.summary}</p>
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

      {emp ? (
        <Card
          title={`History check · ${emp.sessions} comparable ${emp.horizonDays === 1 ? "sessions" : `${emp.horizonDays}-day windows`}`}
        >
          <p className="text-sm leading-relaxed text-ink-secondary">
            Past {emp.horizonDays === 1 ? "sessions" : "windows"} measured from the{" "}
            {emp.reference === "open" ? "open" : "previous close"}, normalized to the starting price
            so a move of {formatSignedPercent(b.target.percent * 100)} counts as reaching the target
            and {formatSignedPercent(b.stop.percent * 100)} as reaching the stop.
            {emp.regimeFiltered
              ? " Only sessions with a similar volatility regime are included."
              : " All available sessions are included (too few matched the current volatility regime to filter)."}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Reached target" value={pct(emp.rates.target)} tone="text-gain-text" />
            <Stat label="Reached stop" value={pct(emp.rates.stop)} tone="text-loss-text" />
            <Stat label="Target first" value={pct(emp.rates.targetFirst)} tone="text-gain-text" />
            <Stat label="Stop first" value={pct(emp.rates.stopFirst)} tone="text-loss-text" />
            <Stat label="Both" value={pct(emp.rates.both)} />
            <Stat label="Neither" value={pct(emp.rates.neither)} />
          </dl>
          {emp.orderInferredShare > 0 ? (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Daily bars do not record the order of a day’s high and low, so for{" "}
              {pct(emp.orderInferredShare)} of the “both” windows the order was inferred from the
              day’s direction (an up day is assumed to visit its low first).
            </p>
          ) : null}
        </Card>
      ) : null}

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
        <dl
          className={cn(
            "grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4",
            c.warnings.length > 0 && "mt-5",
          )}
        >
          <Stat label="Historical sessions" value={c.observations} />
          <Stat label="Simulation paths" value={c.paths.toLocaleString("en-US")} />
          <Stat label="Volatility regime" value={<span className="capitalize">{c.regime}</span>} />
          <Stat label="Regime percentile" value={pct(c.regimePercentile)} />
        </dl>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 font-mono text-xs text-muted">
          <div>
            <dt className="label-caps">Vol windows</dt>
            <dd className="mt-1 font-sans text-ink-secondary">{c.volatilityWindows}</dd>
          </div>
          <div>
            <dt className="label-caps">20 / 60 / 252d vol</dt>
            <dd className="tabular mt-1 text-ink">
              {pct1(r.stats.volatility.d20)} / {pct1(r.stats.volatility.d60)} /{" "}
              {pct1(r.stats.volatility.d252)}
            </dd>
          </div>
          <div>
            <dt className="label-caps">Data</dt>
            <dd className="mt-1 text-ink">
              {r.data.source} · {r.data.firstBarDate} → {r.data.lastBarDate}
            </dd>
          </div>
          <div>
            <dt className="label-caps">Run</dt>
            <dd className="mt-1 text-ink">
              {data.runId ? data.runId.slice(0, 8) : "not stored"} · seed{" "}
              {r.monteCarlo.seed.length > 24
                ? `${r.monteCarlo.seed.slice(0, 24)}…`
                : r.monteCarlo.seed}{" "}
              · {r.computeMs} ms
            </dd>
          </div>
        </dl>
        {c.notes.length > 0 ? (
          <ul className="mt-5 space-y-1.5 text-sm leading-relaxed text-muted" role="list">
            {c.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
