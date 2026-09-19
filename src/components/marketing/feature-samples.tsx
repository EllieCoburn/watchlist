import { SparklineChart } from "@/components/watch";
import { Badge } from "@/components/ui/badge";

/** Small, static visual samples for the feature cards. Purely illustrative. */

export function SampleScenario() {
  return (
    <dl className="space-y-3 font-mono text-sm">
      <div className="flex justify-between text-muted">
        <dt>If PLTR reaches</dt>
        <dd className="tabular text-ink">178.00</dd>
      </div>
      <div className="flex justify-between text-muted">
        <dt>New value</dt>
        <dd className="tabular text-ink">$10,171.43</dd>
      </div>
      <div className="flex justify-between text-muted">
        <dt>Potential profit</dt>
        <dd className="tabular text-gain-text">+$171.43</dd>
      </div>
    </dl>
  );
}

export function SampleWatchlist() {
  return (
    <ul className="space-y-2.5 font-mono text-sm" role="list">
      {[
        ["AAPL", "336.13", "−0.53%", "loss"],
        ["NVDA", "222.27", "+1.33%", "gain"],
        ["MSFT", "493.78", "−0.84%", "loss"],
      ].map(([ticker, price, change, tone]) => (
        <li key={ticker} className="flex items-center justify-between">
          <span className="font-semibold tracking-[0.04em] text-ink">{ticker}</span>
          <span className="tabular flex gap-3">
            <span className="text-ink">{price}</span>
            <span className={tone === "gain" ? "text-gain-text" : "text-loss-text"}>{change}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SampleRiskReward() {
  return (
    <div className="space-y-3 font-mono text-sm">
      <div className="flex justify-between text-muted">
        <span>Target 177.00</span>
        <span className="tabular text-gain-text">+$114.28</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-canvas-deep" aria-hidden="true">
        <span className="w-1/3 bg-loss" />
        <span className="w-2/3 bg-gain" />
      </div>
      <div className="flex justify-between text-muted">
        <span>Stop 174.00</span>
        <span className="tabular text-loss-text">−$57.14</span>
      </div>
      <p className="label-caps text-muted">Risk / reward 2.0 : 1</p>
    </div>
  );
}

export function SampleTrade() {
  return (
    <div className="space-y-3 font-mono text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold tracking-[0.04em] text-ink">PLTR</span>
        <Badge tone="neutral">Closed</Badge>
      </div>
      <div className="flex justify-between text-muted">
        <span>Entry 175.00</span>
        <span>Exit 177.40</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Realized</span>
        <span className="tabular text-gain-text">+$137.14</span>
      </div>
    </div>
  );
}

export function SamplePerformance() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between font-mono text-sm">
        <span className="text-muted">Realized, 90 days</span>
        <span className="tabular text-gain-text">+$1,284.10</span>
      </div>
      <SparklineChart
        direction="up"
        className="h-14"
        values={[0, 80, 60, 140, 220, 190, 260, 300, 280, 360, 410, 380, 460, 520, 500, 560]}
      />
    </div>
  );
}

export function SampleMetrics() {
  return (
    <dl className="grid grid-cols-2 gap-4 font-mono text-sm">
      {[
        ["Win rate", "58%"],
        ["Avg winner", "+$96"],
        ["Avg loser", "−$41"],
        ["Per trade", "+$38"],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="label-caps text-muted">{label}</dt>
          <dd className="tabular mt-1.5 text-lg text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
